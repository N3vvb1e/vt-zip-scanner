/**
 * Secure ZIP Utils
 * Main orchestrator for ZIP file processing with security
 */

// Import and re-export from focused utilities
import { SECURITY_LIMITS } from "./zip/zipSecurityConfig";
export { SECURITY_LIMITS } from "./zip/zipSecurityConfig";
export type {
  ZipSecurityReport,
  ProcessZipOptions,
  SecurityError,
} from "./zip/zipSecurityConfig";

// Re-export main functions
export { analyzeZipSecurity } from "./zip/zipSecurityAnalyzer";
export {
  processZipFileSecurely,
  extractZipFiles,
  getZipFileListing,
} from "./zip/zipExtractor";
export {
  createSafeZip,
  createZipFromBlobs,
  estimateZipSize,
} from "./zip/zipCreator";
export {
  validatePath,
  isDangerousExtension,
  sanitizePath,
} from "./zip/pathValidator";

// Backward compatibility exports
export const MAX_ZIP_SIZE = SECURITY_LIMITS.MAX_ZIP_SIZE;
export const MAX_UNCOMPRESSED_SIZE = SECURITY_LIMITS.MAX_UNCOMPRESSED_SIZE;
export const MAX_FILE_COUNT = SECURITY_LIMITS.MAX_FILE_COUNT;
export const MAX_EXTRACTION_DEPTH = SECURITY_LIMITS.MAX_EXTRACTION_DEPTH;
export const MAX_PATH_LENGTH = SECURITY_LIMITS.MAX_PATH_LENGTH;
export const MAX_SINGLE_FILE_SIZE = SECURITY_LIMITS.MAX_SINGLE_FILE_SIZE;
