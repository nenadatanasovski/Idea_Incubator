/**
 * Request Counter Service
 * Tracks total requests served since server startup
 */

class RequestCounterService {
  private count: number = 0;

  /**
   * Increment the request counter
   */
  increment(): void {
    this.count++;
  }

  /**
   * Get the current request count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Reset the counter (for testing)
   */
  reset(): void {
    this.count = 0;
  }
}

export const requestCounterService = new RequestCounterService();
