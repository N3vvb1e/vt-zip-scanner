/**
 * Enhanced rate limiter for concurrent request handling
 * Supports multiple concurrent requests while respecting rate limits
 */

export interface ConcurrentRateLimitConfig {
  requestLimit: number;
  requestWindow: number; // in milliseconds
  minRequestSpacing: number; // in milliseconds
  maxConcurrent: number; // maximum concurrent requests
  burstAllowance?: number; // allow burst requests up to this limit
}

export interface RequestSlot {
  id: string;
  timestamp: number;
  status: 'pending' | 'active' | 'completed';
  priority: number;
}

export class ConcurrentRateLimiter {
  private requestTimestamps: number[] = [];
  private activeRequests: Map<string, RequestSlot> = new Map();
  private pendingQueue: RequestSlot[] = [];
  private config: ConcurrentRateLimitConfig;
  private nextRequestId = 0;

  constructor(config: ConcurrentRateLimitConfig) {
    this.config = {
      burstAllowance: 0,
      ...config
    };
  }

  /**
   * Request a slot for making an API call
   * Returns a promise that resolves when the request can be made
   */
  async requestSlot(priority: number = 0): Promise<string> {
    const requestId = `req_${++this.nextRequestId}`;
    const slot: RequestSlot = {
      id: requestId,
      timestamp: Date.now(),
      status: 'pending',
      priority
    };

    // Add to pending queue with priority sorting
    this.pendingQueue.push(slot);
    this.pendingQueue.sort((a, b) => b.priority - a.priority);

    return new Promise((resolve) => {
      const checkSlot = async () => {
        if (this.canActivateRequest(requestId)) {
          this.activateRequest(requestId);
          resolve(requestId);
        } else {
          // Wait and check again
          const waitTime = this.getOptimalWaitTime();
          setTimeout(checkSlot, Math.min(waitTime, 1000));
        }
      };
      checkSlot();
    });
  }

  /**
   * Mark a request as completed and free up the slot
   */
  completeRequest(requestId: string): void {
    const slot = this.activeRequests.get(requestId);
    if (slot) {
      slot.status = 'completed';
      this.requestTimestamps.push(slot.timestamp);
      this.activeRequests.delete(requestId);
    }

    // Remove from pending queue if still there
    this.pendingQueue = this.pendingQueue.filter(s => s.id !== requestId);
  }

  /**
   * Check if a specific request can be activated
   */
  private canActivateRequest(requestId: string): boolean {
    const now = Date.now();
    this.cleanupOldRequests(now);

    // Check if this request is at the front of the queue
    const slot = this.pendingQueue.find(s => s.id === requestId);
    if (!slot) return false;

    const isHighestPriority = this.pendingQueue[0]?.id === requestId;
    if (!isHighestPriority) return false;

    // Check concurrent limit
    if (this.activeRequests.size >= this.config.maxConcurrent) {
      return false;
    }

    // Check rate limit
    const totalRequests = this.requestTimestamps.length + this.activeRequests.size;
    if (totalRequests >= this.config.requestLimit) {
      return false;
    }

    // Check minimum spacing
    if (this.requestTimestamps.length > 0 || this.activeRequests.size > 0) {
      const lastRequestTime = this.getLastRequestTime();
      if (lastRequestTime && (now - lastRequestTime) < this.config.minRequestSpacing) {
        return false;
      }
    }

    return true;
  }

  /**
   * Activate a pending request
   */
  private activateRequest(requestId: string): void {
    const slotIndex = this.pendingQueue.findIndex(s => s.id === requestId);
    if (slotIndex >= 0) {
      const slot = this.pendingQueue.splice(slotIndex, 1)[0];
      slot.status = 'active';
      slot.timestamp = Date.now();
      this.activeRequests.set(requestId, slot);
    }
  }

  /**
   * Get the timestamp of the most recent request
   */
  private getLastRequestTime(): number | null {
    const timestamps = [
      ...this.requestTimestamps,
      ...Array.from(this.activeRequests.values()).map(s => s.timestamp)
    ];
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }

  /**
   * Calculate optimal wait time for next request
   */
  private getOptimalWaitTime(): number {
    const now = Date.now();
    this.cleanupOldRequests(now);

    // If under concurrent limit and rate limit, minimal wait
    if (this.activeRequests.size < this.config.maxConcurrent &&
        (this.requestTimestamps.length + this.activeRequests.size) < this.config.requestLimit) {
      
      const lastRequestTime = this.getLastRequestTime();
      if (lastRequestTime) {
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < this.config.minRequestSpacing) {
          return this.config.minRequestSpacing - timeSinceLastRequest;
        }
      }
      return 100; // Minimal wait for next check
    }

    // Calculate wait time based on oldest request
    if (this.requestTimestamps.length > 0) {
      const oldestRequest = Math.min(...this.requestTimestamps);
      return Math.max(100, this.config.requestWindow - (now - oldestRequest) + 500);
    }

    return 1000; // Default wait time
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
   * Get current status information
   */
  getStatus() {
    const now = Date.now();
    this.cleanupOldRequests(now);
    
    return {
      activeRequests: this.activeRequests.size,
      pendingRequests: this.pendingQueue.length,
      completedInWindow: this.requestTimestamps.length,
      totalInWindow: this.requestTimestamps.length + this.activeRequests.size,
      canMakeRequest: this.activeRequests.size < this.config.maxConcurrent &&
                     (this.requestTimestamps.length + this.activeRequests.size) < this.config.requestLimit,
      nextAvailableSlot: this.getOptimalWaitTime()
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestTimestamps = [];
    this.activeRequests.clear();
    this.pendingQueue = [];
  }

  /**
   * Legacy compatibility methods
   */
  canMakeRequest(): boolean {
    return this.getStatus().canMakeRequest;
  }

  getCurrentRequestCount(): number {
    return this.getStatus().totalInWindow;
  }

  getWaitTime(): number {
    return this.getOptimalWaitTime();
  }

  recordRequest(): void {
    // For legacy compatibility - immediate request
    this.requestTimestamps.push(Date.now());
  }
}
