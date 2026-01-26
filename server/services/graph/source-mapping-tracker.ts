/**
 * Source Mapping Job Tracker
 *
 * Tracks active source mapping jobs for real-time status updates and cancellation.
 * Jobs run in the background (fire-and-forget) but we need to:
 * 1. Track their status for UI updates via WebSocket
 * 2. Support cancellation to avoid wasting API tokens
 * 3. Survive page refreshes - frontend can reconnect and get current status
 */

import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Types
// ============================================================================

export type SourceMappingStatus =
  | "pending"
  | "collecting_sources"
  | "mapping"
  | "complete"
  | "failed"
  | "cancelled";

export interface SourceMappingJob {
  id: string;
  sessionId: string;
  status: SourceMappingStatus;
  blocksToMap: number;
  sourcesAvailable: number;
  mappingsCreated: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  // AbortController for cancellation
  abortController?: AbortController;
}

export interface SourceMappingJobInfo {
  id: string;
  sessionId: string;
  status: SourceMappingStatus;
  blocksToMap: number;
  sourcesAvailable: number;
  mappingsCreated: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// ============================================================================
// Tracker Class
// ============================================================================

class SourceMappingTracker {
  // Map of sessionId -> active job
  private activeJobs = new Map<string, SourceMappingJob>();

  // Map of sessionId -> recent completed jobs (for status queries after completion)
  // Auto-cleaned after 5 minutes
  private recentJobs = new Map<string, SourceMappingJob>();

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up old completed jobs every 5 minutes
    this.cleanupInterval = setInterval(
      () => this.cleanupOldJobs(),
      5 * 60 * 1000,
    );
  }

  /**
   * Create a new source mapping job for a session.
   * Returns the job info and abort controller for the caller to use.
   */
  createJob(
    sessionId: string,
    blocksToMap: number,
  ): { job: SourceMappingJobInfo; abortController: AbortController } {
    // Cancel any existing job for this session
    this.cancelJob(sessionId, "Superseded by new job");

    const abortController = new AbortController();
    const job: SourceMappingJob = {
      id: uuidv4(),
      sessionId,
      status: "pending",
      blocksToMap,
      sourcesAvailable: 0,
      mappingsCreated: 0,
      startedAt: new Date().toISOString(),
      abortController,
    };

    this.activeJobs.set(sessionId, job);
    console.log(
      `[SourceMappingTracker] Created job ${job.id} for session ${sessionId}`,
    );

    return {
      job: this.toJobInfo(job),
      abortController,
    };
  }

  /**
   * Update job status when source collection starts
   */
  updateCollecting(sessionId: string): void {
    const job = this.activeJobs.get(sessionId);
    if (job) {
      job.status = "collecting_sources";
      console.log(`[SourceMappingTracker] Job ${job.id} collecting sources`);
    }
  }

  /**
   * Update job with source count and start mapping phase
   */
  updateMapping(sessionId: string, sourcesAvailable: number): void {
    const job = this.activeJobs.get(sessionId);
    if (job) {
      job.status = "mapping";
      job.sourcesAvailable = sourcesAvailable;
      console.log(
        `[SourceMappingTracker] Job ${job.id} mapping ${job.blocksToMap} blocks with ${sourcesAvailable} sources`,
      );
    }
  }

  /**
   * Mark job as complete
   */
  completeJob(sessionId: string, mappingsCreated: number): void {
    const job = this.activeJobs.get(sessionId);
    if (job) {
      job.status = "complete";
      job.mappingsCreated = mappingsCreated;
      job.completedAt = new Date().toISOString();

      // Move to recent jobs for post-completion queries
      this.recentJobs.set(sessionId, { ...job, abortController: undefined });
      this.activeJobs.delete(sessionId);

      console.log(
        `[SourceMappingTracker] Job ${job.id} complete: ${mappingsCreated} mappings`,
      );
    }
  }

  /**
   * Mark job as failed
   */
  failJob(sessionId: string, error: string): void {
    const job = this.activeJobs.get(sessionId);
    if (job) {
      job.status = "failed";
      job.error = error;
      job.completedAt = new Date().toISOString();

      // Move to recent jobs
      this.recentJobs.set(sessionId, { ...job, abortController: undefined });
      this.activeJobs.delete(sessionId);

      console.log(`[SourceMappingTracker] Job ${job.id} failed: ${error}`);
    }
  }

  /**
   * Cancel a job for a session
   */
  cancelJob(sessionId: string, reason?: string): boolean {
    const job = this.activeJobs.get(sessionId);
    if (!job) {
      return false;
    }

    // Abort the controller to signal cancellation
    if (job.abortController) {
      job.abortController.abort();
    }

    job.status = "cancelled";
    job.error = reason || "Cancelled by user";
    job.completedAt = new Date().toISOString();

    // Move to recent jobs
    this.recentJobs.set(sessionId, { ...job, abortController: undefined });
    this.activeJobs.delete(sessionId);

    console.log(
      `[SourceMappingTracker] Job ${job.id} cancelled: ${reason || "by user"}`,
    );
    return true;
  }

  /**
   * Get current job status for a session
   */
  getJobStatus(sessionId: string): SourceMappingJobInfo | null {
    // Check active jobs first
    const activeJob = this.activeJobs.get(sessionId);
    if (activeJob) {
      return this.toJobInfo(activeJob);
    }

    // Check recent completed jobs
    const recentJob = this.recentJobs.get(sessionId);
    if (recentJob) {
      return this.toJobInfo(recentJob);
    }

    return null;
  }

  /**
   * Check if a session has an active (non-complete) job
   */
  hasActiveJob(sessionId: string): boolean {
    return this.activeJobs.has(sessionId);
  }

  /**
   * Check if cancellation was requested for a job
   */
  isCancelled(sessionId: string): boolean {
    const job = this.activeJobs.get(sessionId);
    return job?.abortController?.signal.aborted || false;
  }

  /**
   * Get the abort signal for a session's job
   */
  getAbortSignal(sessionId: string): AbortSignal | null {
    return this.activeJobs.get(sessionId)?.abortController?.signal || null;
  }

  /**
   * Clean up old completed jobs
   */
  private cleanupOldJobs(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    for (const [sessionId, job] of this.recentJobs.entries()) {
      if (job.completedAt) {
        const completedTime = new Date(job.completedAt).getTime();
        if (completedTime < fiveMinutesAgo) {
          this.recentJobs.delete(sessionId);
          console.log(
            `[SourceMappingTracker] Cleaned up old job ${job.id} for session ${sessionId}`,
          );
        }
      }
    }
  }

  /**
   * Convert internal job to external info (without abort controller)
   */
  private toJobInfo(job: SourceMappingJob): SourceMappingJobInfo {
    return {
      id: job.id,
      sessionId: job.sessionId,
      status: job.status,
      blocksToMap: job.blocksToMap,
      sourcesAvailable: job.sourcesAvailable,
      mappingsCreated: job.mappingsCreated,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.activeJobs.clear();
    this.recentJobs.clear();
  }
}

// Singleton export
export const sourceMappingTracker = new SourceMappingTracker();
