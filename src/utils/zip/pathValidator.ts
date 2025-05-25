/**
 * Path Validator
 * Handles validation of file paths for security issues
 */

import {
  SECURITY_LIMITS,
  DANGEROUS_PATH_PATTERNS,
  DANGEROUS_EXTENSIONS,
} from "./zipSecurityConfig";

export interface PathValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * Validates a file path for security issues
 */
export function validatePath(path: string): PathValidationResult {
  // Check length
  if (path.length > SECURITY_LIMITS.MAX_PATH_LENGTH) {
    return {
      safe: false,
      reason: `Path exceeds maximum length (${SECURITY_LIMITS.MAX_PATH_LENGTH} chars)`,
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
export function isDangerousExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? DANGEROUS_EXTENSIONS.has(ext) : false;
}

/**
 * Sanitizes a path for safe use
 */
export function sanitizePath(path: string): string {
  // Remove dangerous characters and patterns
  let sanitized = path
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, "") // Remove control characters
    .replace(/^[/\\]+/, "") // Remove leading slashes
    .replace(/^[a-zA-Z]:/, "") // Remove drive letters
    .replace(/^~/, ""); // Remove home directory reference

  // Normalize path separators
  sanitized = sanitized.replace(/[\\/]+/g, "/");

  // Remove directory traversal attempts
  const parts = sanitized
    .split("/")
    .filter((p) => p && p !== "." && p !== "..");

  // Limit path length
  const result = parts.join("/");
  if (result.length > SECURITY_LIMITS.MAX_PATH_LENGTH) {
    // Truncate from the beginning, keeping the filename
    const filename = parts[parts.length - 1];
    const maxDirLength = SECURITY_LIMITS.MAX_PATH_LENGTH - filename.length - 1;

    if (maxDirLength > 0) {
      const dirParts = parts.slice(0, -1);
      const dirPath = dirParts.join("/");

      if (dirPath.length > maxDirLength) {
        // Take the last few directory parts that fit
        let truncated = "";
        for (let i = dirParts.length - 1; i >= 0; i--) {
          const candidate = dirParts.slice(i).join("/");
          if (candidate.length <= maxDirLength) {
            truncated = candidate;
            break;
          }
        }
        return truncated ? `${truncated}/${filename}` : filename;
      }

      return `${dirPath}/${filename}`;
    }

    return filename.substring(0, SECURITY_LIMITS.MAX_PATH_LENGTH);
  }

  return result || "unnamed_file";
}

/**
 * Validates and sanitizes a path
 */
export function validateAndSanitizePath(path: string): {
  isValid: boolean;
  sanitizedPath: string;
  reason?: string;
} {
  const validation = validatePath(path);

  if (validation.safe) {
    return {
      isValid: true,
      sanitizedPath: path,
    };
  }

  // If not safe, try to sanitize
  const sanitized = sanitizePath(path);
  const sanitizedValidation = validatePath(sanitized);

  return {
    isValid: sanitizedValidation.safe,
    sanitizedPath: sanitized,
    reason: sanitizedValidation.safe ? undefined : validation.reason,
  };
}
