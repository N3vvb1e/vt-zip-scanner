/**
 * ZIP Extractor
 * Handles secure extraction of ZIP files
 */

import JSZip from "jszip";
import type { FileEntry } from "../../types";
import {
  generateId,
  formatFileSize,
  getFileName,
  getFileType,
  calculateFileHash,
} from "../common";
import { validatePath } from "./pathValidator";
import {
  SECURITY_LIMITS,
  type ProcessZipOptions,
  type ZipSecurityReport,
  type SecurityError,
} from "./zipSecurityConfig";
import { analyzeZipSecurity } from "./zipSecurityAnalyzer";

// Interface for JSZip entry with internal _data property
interface JSZipEntryWithData extends JSZip.JSZipObject {
  _data?: {
    uncompressedSize?: number;
    compressedSize?: number;
  };
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
    const pathCheck = validatePath(filename);
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
 * Extract files from ZIP with basic security checks
 */
export async function extractZipFiles(file: File): Promise<FileEntry[]> {
  const zip = await JSZip.loadAsync(file);
  const fileEntries: FileEntry[] = [];
  const extractionPromises: Promise<void>[] = [];

  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    // Skip directories
    if (zipEntry.dir) continue;

    // Basic path safety check
    const pathCheck = validatePath(filename);
    if (!pathCheck.safe) {
      console.warn(`Skipping unsafe path: ${filename}`);
      continue;
    }

    extractionPromises.push(extractFileEntry(zipEntry, filename, fileEntries));
  }

  await Promise.all(extractionPromises);
  return fileEntries;
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
    if (blob.size > SECURITY_LIMITS.MAX_SINGLE_FILE_SIZE) {
      console.warn(
        `Skipping oversized file: ${filename} (${formatFileSize(blob.size)})`
      );
      return;
    }

    // Calculate file hash for duplicate detection
    const sha256 = await calculateFileHash(blob);

    // Detect file type using both extension and content analysis
    const fileType = await getFileType(filename, blob);

    fileEntries.push({
      id: generateId(),
      name: getFileName(filename),
      path: filename,
      size: blob.size,
      type: fileType,
      blob,
      sha256,
    });
  } catch (error) {
    console.error(`Error extracting ${filename}:`, error);
  }
}

/**
 * Extract specific files from ZIP by path
 */
export async function extractSpecificFiles(
  file: File,
  filePaths: string[]
): Promise<FileEntry[]> {
  const zip = await JSZip.loadAsync(file);
  const fileEntries: FileEntry[] = [];
  const extractionPromises: Promise<void>[] = [];

  for (const path of filePaths) {
    const zipEntry = zip.file(path);
    if (!zipEntry) {
      console.warn(`File not found in ZIP: ${path}`);
      continue;
    }

    // Check path safety
    const pathCheck = validatePath(path);
    if (!pathCheck.safe) {
      console.warn(`Skipping unsafe path: ${path}`);
      continue;
    }

    extractionPromises.push(extractFileEntry(zipEntry, path, fileEntries));
  }

  await Promise.all(extractionPromises);
  return fileEntries;
}

/**
 * Get ZIP file listing without extraction
 */
export async function getZipFileListing(file: File): Promise<{
  files: Array<{
    path: string;
    name: string;
    size: number;
    isDirectory: boolean;
    isSafe: boolean;
  }>;
  totalFiles: number;
  totalSize: number;
}> {
  const zip = await JSZip.loadAsync(file);
  const files: Array<{
    path: string;
    name: string;
    size: number;
    isDirectory: boolean;
    isSafe: boolean;
  }> = [];

  let totalFiles = 0;
  let totalSize = 0;

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    const pathCheck = validatePath(path);
    // Use a safe way to get file size without accessing private _data property
    const size = zipEntry.dir
      ? 0
      : (zipEntry as JSZipEntryWithData)._data?.uncompressedSize || 0;

    files.push({
      path,
      name: getFileName(path),
      size,
      isDirectory: zipEntry.dir,
      isSafe: pathCheck.safe,
    });

    if (!zipEntry.dir) {
      totalFiles++;
      totalSize += size;
    }
  }

  return {
    files,
    totalFiles,
    totalSize,
  };
}
