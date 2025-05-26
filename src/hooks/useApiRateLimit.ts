import { useState, useEffect, useRef } from "react";
import { RateLimiter } from "../utils/rateLimiter";
import { ConcurrentRateLimiter } from "../utils/concurrentRateLimiter";
import { RATE_LIMIT_CONFIG } from "../config/queueConfig";
import type { ApiRateLimitData } from "../components/ui/ApiRateLimitIndicator";

export interface UseApiRateLimitOptions {
  updateInterval?: number; // How often to update the data (ms)
  rateLimiter?: RateLimiter | ConcurrentRateLimiter; // Optional external rate limiter instance
}

export function useApiRateLimit(options: UseApiRateLimitOptions = {}) {
  const { updateInterval = 1000, rateLimiter: externalRateLimiter } = options;

  // Create internal rate limiter if none provided
  const internalRateLimiter = useRef(
    new RateLimiter({
      requestLimit: RATE_LIMIT_CONFIG.REQUEST_LIMIT,
      requestWindow: RATE_LIMIT_CONFIG.REQUEST_WINDOW,
      minRequestSpacing: RATE_LIMIT_CONFIG.MIN_REQUEST_SPACING,
    })
  );

  const rateLimiter = externalRateLimiter || internalRateLimiter.current;

  const [rateLimitData, setRateLimitData] = useState<ApiRateLimitData>(() => {
    const currentRequests = rateLimiter.getCurrentRequestCount();
    const canMakeRequest = rateLimiter.canMakeRequest();
    const waitTime = rateLimiter.getWaitTime();

    return {
      currentRequests,
      maxRequests: RATE_LIMIT_CONFIG.REQUEST_LIMIT,
      windowDuration: RATE_LIMIT_CONFIG.REQUEST_WINDOW,
      timeUntilReset: waitTime,
      canMakeRequest,
    };
  });

  // Update rate limit data periodically
  useEffect(() => {
    const updateRateLimitData = () => {
      const currentRequests = rateLimiter.getCurrentRequestCount();
      const canMakeRequest = rateLimiter.canMakeRequest();
      const waitTime = rateLimiter.getWaitTime();

      setRateLimitData({
        currentRequests,
        maxRequests: RATE_LIMIT_CONFIG.REQUEST_LIMIT,
        windowDuration: RATE_LIMIT_CONFIG.REQUEST_WINDOW,
        timeUntilReset: waitTime,
        canMakeRequest,
      });
    };

    // Update immediately
    updateRateLimitData();

    // Set up interval for periodic updates
    const interval = setInterval(updateRateLimitData, updateInterval);

    return () => clearInterval(interval);
  }, [rateLimiter, updateInterval]);

  // Provide methods to interact with the rate limiter
  const recordRequest = () => {
    rateLimiter.recordRequest();
    // Immediately update data after recording a request
    const currentRequests = rateLimiter.getCurrentRequestCount();
    const canMakeRequest = rateLimiter.canMakeRequest();
    const waitTime = rateLimiter.getWaitTime();

    setRateLimitData({
      currentRequests,
      maxRequests: RATE_LIMIT_CONFIG.REQUEST_LIMIT,
      windowDuration: RATE_LIMIT_CONFIG.REQUEST_WINDOW,
      timeUntilReset: waitTime,
      canMakeRequest,
    });
  };

  const resetRateLimit = () => {
    rateLimiter.reset();
    setRateLimitData({
      currentRequests: 0,
      maxRequests: RATE_LIMIT_CONFIG.REQUEST_LIMIT,
      windowDuration: RATE_LIMIT_CONFIG.REQUEST_WINDOW,
      timeUntilReset: 0,
      canMakeRequest: true,
    });
  };

  return {
    rateLimitData,
    recordRequest,
    resetRateLimit,
    rateLimiter,
  };
}
