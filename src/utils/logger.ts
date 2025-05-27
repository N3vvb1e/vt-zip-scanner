/**
 * Professional logging utility for VT ZIP Scanner
 * Provides structured logging with different levels and production-safe output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private appName = 'VT-ZIP-Scanner';

  /**
   * Debug level logging - only shown in development
   * Use for detailed debugging information
   */
  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(`🔍 [${this.appName}] ${message}`, context || '');
    }
  }

  /**
   * Info level logging - shown in development only
   * Use for general application flow information
   */
  info(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.info(`ℹ️ [${this.appName}] ${message}`, context || '');
    }
  }

  /**
   * Warning level logging - shown in all environments
   * Use for recoverable errors or important notices
   */
  warn(message: string, context?: LogContext) {
    console.warn(`⚠️ [${this.appName}] ${message}`, context || '');
  }

  /**
   * Error level logging - shown in all environments
   * Use for errors that need attention
   */
  error(message: string, error?: Error | any, context?: LogContext) {
    console.error(`❌ [${this.appName}] ${message}`, error || '', context || '');
  }

  /**
   * Success level logging - shown in development only
   * Use for successful operations
   */
  success(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.info(`✅ [${this.appName}] ${message}`, context || '');
    }
  }

  /**
   * Performance timing utility
   * Use to measure operation duration
   */
  time(label: string) {
    if (this.isDevelopment) {
      console.time(`⏱️ [${this.appName}] ${label}`);
    }
  }

  timeEnd(label: string) {
    if (this.isDevelopment) {
      console.timeEnd(`⏱️ [${this.appName}] ${label}`);
    }
  }

  /**
   * Group related log messages
   */
  group(label: string) {
    if (this.isDevelopment) {
      console.group(`📁 [${this.appName}] ${label}`);
    }
  }

  groupEnd() {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }

  /**
   * Log API operations with structured data
   */
  api(method: string, url: string, status?: number, duration?: number) {
    const context = {
      method,
      url,
      status,
      duration: duration ? `${duration}ms` : undefined
    };
    
    if (status && status >= 400) {
      this.warn(`API ${method} ${url} failed`, context);
    } else {
      this.debug(`API ${method} ${url}`, context);
    }
  }

  /**
   * Log file operations
   */
  file(operation: string, fileName: string, size?: number, context?: LogContext) {
    const fileContext = {
      operation,
      fileName,
      size: size ? `${(size / 1024 / 1024).toFixed(2)}MB` : undefined,
      ...context
    };
    this.debug(`File ${operation}`, fileContext);
  }

  /**
   * Log scanning operations
   */
  scan(operation: string, fileName: string, status?: string, context?: LogContext) {
    const scanContext = {
      operation,
      fileName,
      status,
      ...context
    };
    
    if (status === 'error') {
      this.error(`Scan ${operation} failed`, undefined, scanContext);
    } else if (status === 'completed') {
      this.success(`Scan ${operation} completed`, scanContext);
    } else {
      this.info(`Scan ${operation}`, scanContext);
    }
  }

  /**
   * Log database operations
   */
  db(operation: string, table?: string, count?: number, context?: LogContext) {
    const dbContext = {
      operation,
      table,
      count,
      ...context
    };
    this.debug(`DB ${operation}`, dbContext);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for external use
export type { LogLevel, LogContext };
