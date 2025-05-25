/**
 * Error handling utilities for consistent error management
 */

import axios from "axios";

export interface AppError {
  code: string;
  message: string;
  originalError?: unknown;
  context?: Record<string, unknown>;
}

export class ErrorHandler {
  /**
   * Create a standardized error object
   */
  static createError(
    code: string,
    message: string,
    originalError?: unknown,
    context?: Record<string, unknown>
  ): AppError {
    return {
      code,
      message,
      originalError,
      context,
    };
  }

  /**
   * Handle Axios errors with specific error codes
   */
  static handleAxiosError(error: unknown, context?: string): AppError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;

      switch (status) {
        case 401:
          return this.createError(
            "UNAUTHORIZED",
            "Invalid API key or authentication failed",
            error,
            { context, status, statusText }
          );

        case 403:
          return this.createError(
            "FORBIDDEN",
            "Access denied - check API key permissions",
            error,
            { context, status, statusText }
          );

        case 429:
          return this.createError(
            "RATE_LIMIT",
            "Rate limit exceeded - too many requests",
            error,
            { context, status, statusText }
          );

        case 404:
          return this.createError(
            "NOT_FOUND",
            "Resource not found",
            error,
            { context, status, statusText }
          );

        case 500:
        case 502:
        case 503:
        case 504:
          return this.createError(
            "SERVER_ERROR",
            "Server error - please try again later",
            error,
            { context, status, statusText }
          );

        default:
          return this.createError(
            "HTTP_ERROR",
            `HTTP ${status}: ${statusText || "Request failed"}`,
            error,
            { context, status, statusText }
          );
      }
    }

    return this.createError(
      "NETWORK_ERROR",
      "Network error - check your connection",
      error,
      { context }
    );
  }

  /**
   * Handle generic errors with fallback
   */
  static handleGenericError(
    error: unknown,
    defaultMessage: string,
    context?: string
  ): AppError {
    if (error instanceof Error) {
      return this.createError(
        "GENERIC_ERROR",
        error.message || defaultMessage,
        error,
        { context }
      );
    }

    return this.createError(
      "UNKNOWN_ERROR",
      defaultMessage,
      error,
      { context }
    );
  }

  /**
   * Log error with consistent format
   */
  static logError(error: AppError, level: "error" | "warn" = "error"): void {
    const logData = {
      code: error.code,
      message: error.message,
      context: error.context,
      originalError: error.originalError,
    };

    if (level === "error") {
      console.error("Application Error:", logData);
    } else {
      console.warn("Application Warning:", logData);
    }
  }

  /**
   * Check if error is a specific type
   */
  static isErrorType(error: AppError, code: string): boolean {
    return error.code === code;
  }

  /**
   * Check if error is rate limit related
   */
  static isRateLimitError(error: AppError): boolean {
    return error.code === "RATE_LIMIT";
  }

  /**
   * Check if error is authentication related
   */
  static isAuthError(error: AppError): boolean {
    return error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN";
  }

  /**
   * Check if error is network related
   */
  static isNetworkError(error: AppError): boolean {
    return error.code === "NETWORK_ERROR" || error.code === "SERVER_ERROR";
  }
}
