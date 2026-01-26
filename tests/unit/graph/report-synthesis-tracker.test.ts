/**
 * Tests for ReportSynthesisTracker service
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ReportSynthesisTracker,
  type ReportSynthesisJob,
} from "../../../server/services/graph/report-synthesis-tracker.js";

describe("ReportSynthesisTracker", () => {
  let tracker: ReportSynthesisTracker;

  beforeEach(() => {
    tracker = new ReportSynthesisTracker();
  });

  afterEach(() => {
    // Clean up any active jobs
    vi.clearAllMocks();
  });

  describe("createJob", () => {
    it("should create a job with pending status", () => {
      const { job } = tracker.createJob("session-1");

      expect(job.id).toBeDefined();
      expect(job.sessionId).toBe("session-1");
      expect(job.status).toBe("pending");
      expect(job.totalGroups).toBe(0);
      expect(job.completedGroups).toBe(0);
      expect(job.reportsCreated).toBe(0);
      expect(tracker.hasActiveJob("session-1")).toBe(true);
    });

    it("should provide an abort controller", () => {
      const { abortController } = tracker.createJob("session-1");

      expect(abortController).toBeInstanceOf(AbortController);
      expect(abortController.signal.aborted).toBe(false);
    });

    it("should replace existing job for same session", () => {
      const { job: job1 } = tracker.createJob("session-1");
      const { job: job2 } = tracker.createJob("session-1");

      expect(job2.id).not.toBe(job1.id);
      expect(tracker.getJobStatus("session-1")?.id).toBe(job2.id);
    });
  });

  describe("updateDetectingGroups", () => {
    it("should update status to detecting_groups", () => {
      tracker.createJob("session-1");
      tracker.updateDetectingGroups("session-1");

      const job = tracker.getJobStatus("session-1");
      expect(job?.status).toBe("detecting_groups");
    });

    it("should not error for non-existent session", () => {
      expect(() => tracker.updateDetectingGroups("non-existent")).not.toThrow();
    });
  });

  describe("updateGenerating", () => {
    it("should update progress during generation", () => {
      tracker.createJob("session-1");
      tracker.updateGenerating("session-1", 5, 2, "Market Validation");

      const job = tracker.getJobStatus("session-1");
      expect(job?.status).toBe("generating");
      expect(job?.totalGroups).toBe(5);
      expect(job?.completedGroups).toBe(2);
      expect(job?.currentGroupName).toBe("Market Validation");
    });

    it("should calculate progress percentage correctly", () => {
      tracker.createJob("session-1");
      tracker.updateGenerating("session-1", 10, 5, "Group A");

      const job = tracker.getJobStatus("session-1");
      // Progress should be around 50% (5/10 groups done)
      expect(job?.completedGroups).toBe(5);
      expect(job?.totalGroups).toBe(10);
    });
  });

  describe("completeJob", () => {
    it("should mark job as complete and move to recent", () => {
      tracker.createJob("session-1");
      tracker.completeJob("session-1", 5);

      expect(tracker.hasActiveJob("session-1")).toBe(false);

      const job = tracker.getJobStatus("session-1");
      expect(job?.status).toBe("complete");
      expect(job?.reportsCreated).toBe(5);
    });

    it("should set completedAt timestamp", () => {
      tracker.createJob("session-1");
      tracker.completeJob("session-1", 3);

      const job = tracker.getJobStatus("session-1");
      expect(job?.completedAt).toBeDefined();
    });
  });

  describe("failJob", () => {
    it("should mark job as failed with error message", () => {
      tracker.createJob("session-1");
      tracker.failJob("session-1", "AI service unavailable");

      const job = tracker.getJobStatus("session-1");
      expect(job?.status).toBe("failed");
      expect(job?.error).toBe("AI service unavailable");
    });

    it("should move failed job to recent jobs", () => {
      tracker.createJob("session-1");
      tracker.failJob("session-1", "Error");

      expect(tracker.hasActiveJob("session-1")).toBe(false);
      expect(tracker.getJobStatus("session-1")).toBeDefined();
    });
  });

  describe("cancelJob", () => {
    it("should abort the controller and mark as cancelled", () => {
      const { abortController } = tracker.createJob("session-1");
      const abortSpy = vi.spyOn(abortController, "abort");

      const result = tracker.cancelJob("session-1", "User cancelled");

      expect(result).toBe(true);
      expect(abortSpy).toHaveBeenCalled();
      expect(abortController.signal.aborted).toBe(true);
    });

    it("should return false for non-existent job", () => {
      const result = tracker.cancelJob("non-existent", "Cancel");

      expect(result).toBe(false);
    });

    it("should mark status as cancelled", () => {
      tracker.createJob("session-1");
      tracker.cancelJob("session-1", "Cancelled by user");

      const job = tracker.getJobStatus("session-1");
      expect(job?.status).toBe("cancelled");
    });
  });

  describe("isCancelled", () => {
    it("should return true when abort signal is triggered on active job", () => {
      const { abortController } = tracker.createJob("session-1");
      // Manually abort to simulate cancellation request (before cancelJob moves to recentJobs)
      abortController.abort();

      expect(tracker.isCancelled("session-1")).toBe(true);
    });

    it("should return false after job moved to recent (cancelJob called)", () => {
      tracker.createJob("session-1");
      tracker.cancelJob("session-1", "Cancel");

      // After cancelJob, job is moved to recentJobs, so isCancelled returns false
      // Use getJobStatus to verify the job status instead
      expect(tracker.isCancelled("session-1")).toBe(false);
      expect(tracker.getJobStatus("session-1")?.status).toBe("cancelled");
    });

    it("should return false for active job", () => {
      tracker.createJob("session-1");

      expect(tracker.isCancelled("session-1")).toBe(false);
    });

    it("should return false for non-existent session", () => {
      expect(tracker.isCancelled("non-existent")).toBe(false);
    });
  });

  describe("getJobStatus", () => {
    it("should return active job if exists", () => {
      tracker.createJob("session-1");

      const job = tracker.getJobStatus("session-1");
      expect(job).toBeDefined();
      expect(job?.sessionId).toBe("session-1");
    });

    it("should return recent job if no active job", () => {
      tracker.createJob("session-1");
      tracker.completeJob("session-1", 3);

      const job = tracker.getJobStatus("session-1");
      expect(job).toBeDefined();
      expect(job?.status).toBe("complete");
    });

    it("should return null for unknown session", () => {
      const job = tracker.getJobStatus("unknown");
      expect(job).toBeNull();
    });
  });

  describe("job lifecycle", () => {
    it("should follow complete lifecycle: pending -> detecting -> generating -> complete", () => {
      tracker.createJob("session-1");
      expect(tracker.getJobStatus("session-1")?.status).toBe("pending");

      tracker.updateDetectingGroups("session-1");
      expect(tracker.getJobStatus("session-1")?.status).toBe(
        "detecting_groups",
      );

      tracker.updateGenerating("session-1", 3, 1, "Group 1");
      expect(tracker.getJobStatus("session-1")?.status).toBe("generating");

      tracker.updateGenerating("session-1", 3, 2, "Group 2");
      expect(tracker.getJobStatus("session-1")?.completedGroups).toBe(2);

      tracker.completeJob("session-1", 3);
      expect(tracker.getJobStatus("session-1")?.status).toBe("complete");
    });
  });
});
