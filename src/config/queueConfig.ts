/**
 * Configuration constants for queue processing
 */

// VirusTotal rate limit: 4 requests per minute (optimized timing)
export const RATE_LIMIT_CONFIG = {
  REQUEST_LIMIT: 4,
  REQUEST_WINDOW: 60 * 1000, // 60 seconds
  POLL_INTERVAL: 20000, // 20 seconds
  RATE_LIMITED_POLL_INTERVAL: 60000, // 1 minute
  BATCH_SUBMIT_DELAY: 2000, // 2 seconds
  MIN_REQUEST_SPACING: 18000, // 18 seconds
} as const;

// Auto-save configuration
export const SAVE_CONFIG = {
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  SINGLE_FILE_SAVE_INTERVAL: 15000, // 15 seconds
  IMMEDIATE_SAVE_DELAY: 1000, // 1 second
} as const;

// Scan timeout configuration
export const SCAN_CONFIG = {
  MAX_SCAN_TIME: 10 * 60 * 1000, // 10 minutes
} as const;

// Processing configuration
export const PROCESSING_CONFIG = {
  SINGLE_FILE_POLL_DELAY: 3000, // 3 seconds for single files
  BATCH_WAIT_TIME: 5000, // 5 seconds wait for batch processing
  SINGLE_FILE_WAIT_TIME: 2000, // 2 seconds wait for single files
  RETRY_DELAY_MULTIPLIER: 2, // Multiply by this for retry delays
  MAX_RETRIES: 3, // Maximum retry attempts
  ENABLE_CONCURRENT_PROCESSING: false, // Enable concurrent uploads
  MAX_CONCURRENT_UPLOADS: 2, // Maximum simultaneous uploads
} as const;
