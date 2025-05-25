/**
 * Rate limiter utility for managing API request limits
 */

export interface RateLimitConfig {
  requestLimit: number;
  requestWindow: number; // in milliseconds
  minRequestSpacing: number; // in milliseconds
}

export class RateLimiter {
  private requestTimestamps: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request can be made within rate limits
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    this.cleanupOldRequests(now);
    return this.requestTimestamps.length < this.config.requestLimit;
  }

  /**
   * Record a request timestamp
   */
  recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Calculate how long to wait before making the next request
   */
  getWaitTime(): number {
    const now = Date.now();
    this.cleanupOldRequests(now);

    // Check minimum spacing between requests
    if (this.requestTimestamps.length > 0) {
      const lastRequest = Math.max(...this.requestTimestamps);
      const timeSinceLastRequest = now - lastRequest;
      if (timeSinceLastRequest < this.config.minRequestSpacing) {
        return this.config.minRequestSpacing - timeSinceLastRequest;
      }
    }

    // If under limit, no wait needed
    if (this.requestTimestamps.length < this.config.requestLimit) {
      return 0;
    }

    // Calculate wait time based on oldest request
    const oldestRequest = Math.min(...this.requestTimestamps);
    return this.config.requestWindow - (now - oldestRequest) + 1000; // Add 1s buffer
  }

  /**
   * Remove old request timestamps outside the window
   */
  private cleanupOldRequests(now: number): void {
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.config.requestWindow
    );
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestTimestamps = [];
  }

  /**
   * Get current request count within the window
   */
  getCurrentRequestCount(): number {
    this.cleanupOldRequests(Date.now());
    return this.requestTimestamps.length;
  }
}
