/**
 * ZIP Security Analyzer
 * Analyzes ZIP files for security threats without full extraction
 */

import JSZip from "jszip";
import { formatFileSize } from "../common";
import { validatePath, isDangerousExtension } from "./pathValidator";
import {
  SECURITY_LIMITS,
  type ZipSecurityReport,
  type ProcessZipOptions,
  type ZipEntryWithData,
  createSecurityReport,
} from "./zipSecurityConfig";

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
    if (file.size > SECURITY_LIMITS.MAX_ZIP_SIZE) {
      errors.push(
        `ZIP file exceeds maximum size (${formatFileSize(
          SECURITY_LIMITS.MAX_ZIP_SIZE
        )})`
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
    if (entries.length > SECURITY_LIMITS.MAX_FILE_COUNT) {
      errors.push(
        `ZIP contains too many files (${entries.length} > ${SECURITY_LIMITS.MAX_FILE_COUNT})`
      );
    }

    // Analyze each entry
    for (const [path, zipEntry] of entries) {
      if (zipEntry.dir) continue;

      fileCount++;

      // Check path safety
      const pathCheck = validatePath(path);
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

      // Analyze compression data
      const compressionAnalysis = analyzeCompressionData(
        path,
        zipEntry as ZipEntryWithData
      );
      totalUncompressedSize += compressionAnalysis.uncompressedSize;
      totalCompressedSize += compressionAnalysis.compressedSize;

      // Add warnings and errors from compression analysis
      warnings.push(...compressionAnalysis.warnings);
      errors.push(...compressionAnalysis.errors);
      suspiciousFiles.push(...compressionAnalysis.suspiciousFiles);

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
    if (totalUncompressedSize > SECURITY_LIMITS.MAX_UNCOMPRESSED_SIZE) {
      errors.push(
        `Total uncompressed size exceeds limit (${formatFileSize(
          totalUncompressedSize
        )})`
      );
    }

    // Calculate overall compression ratio
    const overallRatio =
      totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0;

    if (overallRatio > SECURITY_LIMITS.MAX_OVERALL_COMPRESSION_RATIO) {
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
 * Analyzes compression data for a single ZIP entry
 */
function analyzeCompressionData(
  path: string,
  zipEntry: ZipEntryWithData
): {
  uncompressedSize: number;
  compressedSize: number;
  warnings: string[];
  errors: string[];
  suspiciousFiles: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suspiciousFiles: string[] = [];

  const zipEntryData = zipEntry._data;
  const uncompressedSize = zipEntryData?.uncompressedSize || 0;
  const compressedSize = zipEntryData?.compressedSize || 0;

  // Check for suspiciously high compression ratio (potential ZIP bomb)
  if (uncompressedSize > 0 && compressedSize > 0) {
    const ratio = uncompressedSize / compressedSize;
    if (ratio > SECURITY_LIMITS.MAX_COMPRESSION_RATIO) {
      warnings.push(
        `High compression ratio detected for ${path}: ${ratio.toFixed(1)}:1`
      );
      suspiciousFiles.push(path);
    }
  }

  // Check individual file size
  if (uncompressedSize > SECURITY_LIMITS.MAX_SINGLE_FILE_SIZE) {
    errors.push(
      `File ${path} exceeds maximum size (${formatFileSize(uncompressedSize)})`
    );
  }

  return {
    uncompressedSize,
    compressedSize,
    warnings,
    errors,
    suspiciousFiles,
  };
}

/**
 * Quick security check for ZIP files
 */
export async function quickSecurityCheck(file: File | Blob): Promise<{
  isLikelySafe: boolean;
  reason?: string;
}> {
  // Basic size check
  if (file.size > SECURITY_LIMITS.MAX_ZIP_SIZE) {
    return {
      isLikelySafe: false,
      reason: `File too large (${formatFileSize(file.size)})`,
    };
  }

  try {
    // Try to load ZIP structure without extracting
    const zip = await JSZip.loadAsync(file);
    const entries = Object.entries(zip.files);

    // Check file count
    if (entries.length > SECURITY_LIMITS.MAX_FILE_COUNT) {
      return {
        isLikelySafe: false,
        reason: `Too many files (${entries.length})`,
      };
    }

    // Quick path check
    for (const [path] of entries) {
      const pathCheck = validatePath(path);
      if (!pathCheck.safe) {
        return {
          isLikelySafe: false,
          reason: `Unsafe path: ${path}`,
        };
      }
    }

    return { isLikelySafe: true };
  } catch {
    return {
      isLikelySafe: false,
      reason: "Invalid ZIP file",
    };
  }
}
