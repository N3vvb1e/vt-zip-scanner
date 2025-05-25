import JSZip from "jszip";
import type { FileEntry } from "../types";
import {
  generateId,
  formatFileSize,
  getFileName,
  getFileType,
  calculateFileHash,
} from "./common";

// Security constants
export const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024; // 500 MB total uncompressed
export const MAX_FILE_COUNT = 1000; // Maximum number of files
export const MAX_EXTRACTION_DEPTH = 3; // Maximum nested ZIP depth
export const MAX_PATH_LENGTH = 255; // Maximum path length
export const MAX_SINGLE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file

// Dangerous file extensions that could indicate malicious content
const DANGEROUS_EXTENSIONS = new Set([
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
const DANGEROUS_PATH_PATTERNS = [
  /\.\.[/\\]/, // Directory traversal
  /^[/\\]/, // Absolute paths
  /^[a-zA-Z]:/, // Windows drive letters
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001f]/, // Control characters
  /^~/, // Home directory reference
];

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

interface ZipEntryWithData extends JSZip.JSZipObject {
  _data?: {
    uncompressedSize?: number;
    compressedSize?: number;
  };
}

interface SecurityError extends Error {
  securityReport: ZipSecurityReport;
}

/**
 * Validates a file path for security issues
 */
function isPathSafe(path: string): { safe: boolean; reason?: string } {
  // Check length
  if (path.length > MAX_PATH_LENGTH) {
    return {
      safe: false,
      reason: `Path exceeds maximum length (${MAX_PATH_LENGTH} chars)`,
    };
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return { safe: false, reason: "Path contains dangerous pattern" };
    }
  }

  // Check for null bytes
  if (path.includes("\0")) {
    return { safe: false, reason: "Path contains null bytes" };
  }

  // Normalize and check if path tries to escape
  const normalized = path.replace(/[\\/]+/g, "/");
  const parts = normalized.split("/").filter((p) => p && p !== ".");

  let depth = 0;
  for (const part of parts) {
    if (part === "..") {
      depth--;
      if (depth < 0) {
        return { safe: false, reason: "Path attempts directory traversal" };
      }
    } else {
      depth++;
    }
  }

  return { safe: true };
}

/**
 * Checks if a file extension is potentially dangerous
 */
function isDangerousExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? DANGEROUS_EXTENSIONS.has(ext) : false;
}

/**
 * Analyzes a ZIP file for security issues without fully extracting
 */
export async function analyzeZipSecurity(
  file: File | Blob,
  options: ProcessZipOptions = {}
): Promise<ZipSecurityReport> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suspiciousFiles: string[] = [];

  let fileCount = 0;
  let totalUncompressedSize = 0;
  let totalCompressedSize = 0;
  let maxDepth = 0;

  try {
    // Check initial file size
    if (file.size > MAX_ZIP_SIZE) {
      errors.push(
        `ZIP file exceeds maximum size (${formatFileSize(MAX_ZIP_SIZE)})`
      );
      return createSecurityReport(false, warnings, errors, {
        fileCount: 0,
        totalCompressedSize: file.size,
        totalUncompressedSize: 0,
        compressionRatio: 0,
        maxDepth: 0,
        suspiciousFiles: [],
      });
    }

    const zip = await JSZip.loadAsync(file);
    const entries = Object.entries(zip.files);

    // Check file count
    if (entries.length > MAX_FILE_COUNT) {
      errors.push(
        `ZIP contains too many files (${entries.length} > ${MAX_FILE_COUNT})`
      );
    }

    // Analyze each entry
    for (const [path, zipEntry] of entries) {
      if (zipEntry.dir) continue;

      fileCount++;

      // Check path safety
      const pathCheck = isPathSafe(path);
      if (!pathCheck.safe) {
        errors.push(`Unsafe path detected: ${path} - ${pathCheck.reason}`);
        suspiciousFiles.push(path);
        continue;
      }

      // Check for dangerous extensions
      if (isDangerousExtension(path)) {
        warnings.push(`Potentially dangerous file type: ${path}`);
        suspiciousFiles.push(path);
      }

      // Check uncompressed size (if available)
      const zipEntryData = (zipEntry as ZipEntryWithData)._data;
      const uncompressedSize = zipEntryData?.uncompressedSize || 0;
      totalUncompressedSize += uncompressedSize;
      totalCompressedSize += zipEntryData?.compressedSize || 0;

      // Check for suspiciously high compression ratio (potential ZIP bomb)
      if (uncompressedSize > 0 && zipEntryData?.compressedSize) {
        const ratio = uncompressedSize / zipEntryData.compressedSize;
        if (ratio > 100) {
          warnings.push(
            `High compression ratio detected for ${path}: ${ratio.toFixed(1)}:1`
          );
          suspiciousFiles.push(path);
        }
      }

      // Check individual file size
      if (uncompressedSize > MAX_SINGLE_FILE_SIZE) {
        errors.push(
          `File ${path} exceeds maximum size (${formatFileSize(
            uncompressedSize
          )})`
        );
      }

      // Check for nested ZIPs
      if (path.toLowerCase().endsWith(".zip")) {
        maxDepth = Math.max(maxDepth, 1);
        if (!options.allowNestedZips) {
          warnings.push(`Nested ZIP file detected: ${path}`);
          suspiciousFiles.push(path);
        }
      }
    }

    // Check total uncompressed size
    if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
      errors.push(
        `Total uncompressed size exceeds limit (${formatFileSize(
          totalUncompressedSize
        )})`
      );
    }

    // Calculate overall compression ratio
    const overallRatio =
      totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0;

    if (overallRatio > 50) {
      warnings.push(
        `High overall compression ratio: ${overallRatio.toFixed(
          1
        )}:1 (potential ZIP bomb)`
      );
    }
  } catch (error) {
    errors.push(
      `Failed to analyze ZIP: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  const isSecure =
    errors.length === 0 && (options.strictMode ? warnings.length === 0 : true);

  return createSecurityReport(isSecure, warnings, errors, {
    fileCount,
    totalCompressedSize,
    totalUncompressedSize,
    compressionRatio:
      totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0,
    maxDepth,
    suspiciousFiles: [...new Set(suspiciousFiles)],
  });
}

/**
 * Securely process a ZIP file with security checks
 */
export async function processZipFileSecurely(
  file: File,
  options: ProcessZipOptions = {}
): Promise<{ files: FileEntry[]; securityReport: ZipSecurityReport }> {
  // First, analyze the ZIP for security issues
  const securityReport = await analyzeZipSecurity(file, options);

  // If not secure, throw with details
  if (!securityReport.isSecure) {
    const error = new Error("ZIP file failed security checks") as SecurityError;
    error.securityReport = securityReport;
    throw error;
  }

  // Extract files with additional runtime checks
  const zip = await JSZip.loadAsync(file);
  const fileEntries: FileEntry[] = [];
  const extractionPromises: Promise<void>[] = [];

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    // Skip directories
    if (zipEntry.dir) continue;

    // Double-check path safety
    const pathCheck = isPathSafe(filename);
    if (!pathCheck.safe) {
      console.warn(`Skipping unsafe path: ${filename}`);
      continue;
    }

    extractionPromises.push(extractFileEntry(zipEntry, filename, fileEntries));
  }

  await Promise.all(extractionPromises);

  return { files: fileEntries, securityReport };
}

/**
 * Extract a single file entry with size limits
 */
async function extractFileEntry(
  zipEntry: JSZip.JSZipObject,
  filename: string,
  fileEntries: FileEntry[]
): Promise<void> {
  try {
    // Use streaming to avoid memory issues with large files
    const blob = await zipEntry.async("blob");

    // Final size check
    if (blob.size > MAX_SINGLE_FILE_SIZE) {
      console.warn(
        `Skipping oversized file: ${filename} (${formatFileSize(blob.size)})`
      );
      return;
    }

    // Calculate file hash for duplicate detection
    const sha256 = await calculateFileHash(blob);

    fileEntries.push({
      id: generateId(),
      name: getFileName(filename),
      path: filename,
      size: blob.size,
      type: getFileType(filename),
      blob,
      sha256,
    });
  } catch (error) {
    console.error(`Error extracting ${filename}:`, error);
  }
}

/**
 * Create a new zip file containing only safe files
 */
export async function createSafeZip(files: FileEntry[]): Promise<Blob> {
  const zip = new JSZip();

  // Add each file to the zip with path validation
  for (const file of files) {
    if (file.blob) {
      // Ensure the path is safe before adding
      const pathCheck = isPathSafe(file.path);
      if (pathCheck.safe) {
        zip.file(file.path, file.blob);
      } else {
        // Use just the filename if path is unsafe
        zip.file(file.name, file.blob);
      }
    }
  }

  // Generate the zip file
  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: {
      level: 9,
    },
  });
}

/**
 * Helper to create security report
 */
function createSecurityReport(
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
