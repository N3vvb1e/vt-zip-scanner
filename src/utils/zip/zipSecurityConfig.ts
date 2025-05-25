/**
 * ZIP Security Configuration
 * Contains security constants and configuration for ZIP processing
 */

import JSZip from "jszip";

// Security limits
export const SECURITY_LIMITS = {
  MAX_ZIP_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_UNCOMPRESSED_SIZE: 500 * 1024 * 1024, // 500 MB total uncompressed
  MAX_FILE_COUNT: 1000, // Maximum number of files
  MAX_EXTRACTION_DEPTH: 3, // Maximum nested ZIP depth
  MAX_PATH_LENGTH: 255, // Maximum path length
  MAX_SINGLE_FILE_SIZE: 50 * 1024 * 1024, // 50 MB per file
  MAX_COMPRESSION_RATIO: 100, // Maximum compression ratio for individual files
  MAX_OVERALL_COMPRESSION_RATIO: 50, // Maximum overall compression ratio
} as const;

// Dangerous file extensions that could indicate malicious content
export const DANGEROUS_EXTENSIONS = new Set([
  "scr",
  "vbs",
  "wsf",
  "wsh",
  "bat",
  "cmd",
  "com",
  "pif",
  "reg",
  "ps1",
  "ps2",
  "jar",
  "jnlp",
  "application",
]);

// Path traversal patterns
export const DANGEROUS_PATH_PATTERNS = [
  /\.\.[/\\]/, // Directory traversal
  /^[/\\]/, // Absolute paths
  /^[a-zA-Z]:/, // Windows drive letters
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f]/, // Control characters
  /^~/, // Home directory reference
] as const;

// Security report interfaces
export interface ZipSecurityReport {
  isSecure: boolean;
  warnings: string[];
  errors: string[];
  stats: {
    fileCount: number;
    totalCompressedSize: number;
    totalUncompressedSize: number;
    compressionRatio: number;
    maxDepth: number;
    suspiciousFiles: string[];
  };
}

export interface ProcessZipOptions {
  maxDepth?: number;
  allowNestedZips?: boolean;
  strictMode?: boolean;
}

export interface ZipEntryWithData extends JSZip.JSZipObject {
  _data?: {
    uncompressedSize?: number;
    compressedSize?: number;
  };
}

export interface SecurityError extends Error {
  securityReport: ZipSecurityReport;
}

/**
 * Create a security report
 */
export function createSecurityReport(
  isSecure: boolean,
  warnings: string[],
  errors: string[],
  stats: ZipSecurityReport["stats"]
): ZipSecurityReport {
  return {
    isSecure,
    warnings,
    errors,
    stats,
  };
}
