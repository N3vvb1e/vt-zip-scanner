/**
 * ZIP Creator
 * Handles creation of ZIP files with security validation
 */

import JSZip from "jszip";
import type { FileEntry } from "../../types";
import { validateAndSanitizePath } from "./pathValidator";

export interface ZipCreationOptions {
  compression?: "STORE" | "DEFLATE";
  compressionLevel?: number;
  sanitizePaths?: boolean;
  includeMetadata?: boolean;
}

/**
 * Create a new zip file containing only safe files
 */
export async function createSafeZip(
  files: FileEntry[],
  options: ZipCreationOptions = {}
): Promise<Blob> {
  const {
    compression = "DEFLATE",
    compressionLevel = 9,
    sanitizePaths = true,
    includeMetadata = false,
  } = options;

  const zip = new JSZip();

  // Add each file to the zip with path validation
  for (const file of files) {
    if (!file.blob) {
      console.warn(`Skipping file without blob: ${file.name}`);
      continue;
    }

    let targetPath = file.path;

    if (sanitizePaths) {
      const pathResult = validateAndSanitizePath(file.path);
      if (!pathResult.isValid) {
        console.warn(`Using filename for unsafe path: ${file.path}`);
        targetPath = file.name;
      } else {
        targetPath = pathResult.sanitizedPath;
      }
    }

    // Ensure unique paths by adding suffix if needed
    targetPath = ensureUniquePath(zip, targetPath);

    zip.file(targetPath, file.blob);

    // Add metadata file if requested
    if (includeMetadata) {
      const metadataPath = `${targetPath}.metadata.json`;
      const metadata = {
        originalName: file.name,
        originalPath: file.path,
        size: file.size,
        type: file.type,
        sha256: file.sha256,
        createdAt: new Date().toISOString(),
      };
      zip.file(metadataPath, JSON.stringify(metadata, null, 2));
    }
  }

  // Generate the zip file
  return await zip.generateAsync({
    type: "blob",
    compression,
    compressionOptions: {
      level: compressionLevel,
    },
  });
}

/**
 * Create a ZIP file from file blobs with custom structure
 */
export async function createZipFromBlobs(
  fileMap: Map<string, Blob>,
  options: ZipCreationOptions = {}
): Promise<Blob> {
  const {
    compression = "DEFLATE",
    compressionLevel = 9,
    sanitizePaths = true,
  } = options;

  const zip = new JSZip();

  for (const [path, blob] of fileMap) {
    let targetPath = path;

    if (sanitizePaths) {
      const pathResult = validateAndSanitizePath(path);
      if (!pathResult.isValid) {
        console.warn(`Skipping file with unsafe path: ${path}`);
        continue;
      }
      targetPath = pathResult.sanitizedPath;
    }

    // Ensure unique paths
    targetPath = ensureUniquePath(zip, targetPath);
    zip.file(targetPath, blob);
  }

  return await zip.generateAsync({
    type: "blob",
    compression,
    compressionOptions: {
      level: compressionLevel,
    },
  });
}

/**
 * Create a ZIP file with directory structure
 */
export async function createStructuredZip(
  structure: ZipStructure,
  options: ZipCreationOptions = {}
): Promise<Blob> {
  const {
    compression = "DEFLATE",
    compressionLevel = 9,
  } = options;

  const zip = new JSZip();

  await addStructureToZip(zip, structure, "");

  return await zip.generateAsync({
    type: "blob",
    compression,
    compressionOptions: {
      level: compressionLevel,
    },
  });
}

/**
 * Ensure a path is unique within the ZIP
 */
function ensureUniquePath(zip: JSZip, originalPath: string): string {
  let path = originalPath;
  let counter = 1;

  while (zip.file(path)) {
    const lastDotIndex = originalPath.lastIndexOf(".");
    if (lastDotIndex > 0) {
      const name = originalPath.substring(0, lastDotIndex);
      const ext = originalPath.substring(lastDotIndex);
      path = `${name}_${counter}${ext}`;
    } else {
      path = `${originalPath}_${counter}`;
    }
    counter++;
  }

  return path;
}

/**
 * Add structure to ZIP recursively
 */
async function addStructureToZip(
  zip: JSZip,
  structure: ZipStructure,
  basePath: string
): Promise<void> {
  for (const [name, item] of Object.entries(structure)) {
    const currentPath = basePath ? `${basePath}/${name}` : name;

    if (item instanceof Blob) {
      // It's a file
      zip.file(currentPath, item);
    } else if (typeof item === "object" && item !== null) {
      // It's a directory
      const folder = zip.folder(currentPath);
      if (folder) {
        await addStructureToZip(folder, item, "");
      }
    }
  }
}

// Type for structured ZIP creation
export type ZipStructure = {
  [key: string]: Blob | ZipStructure;
};

/**
 * Estimate ZIP file size before creation
 */
export function estimateZipSize(files: FileEntry[]): {
  estimatedSize: number;
  compressionRatio: number;
} {
  const totalUncompressedSize = files.reduce((sum, file) => sum + file.size, 0);
  
  // Rough estimation: text files compress to ~30%, binary files to ~80%
  const estimatedCompressedSize = files.reduce((sum, file) => {
    const isTextFile = file.type.startsWith("text/") || 
                      file.type === "application/json" ||
                      file.type === "application/xml";
    
    const compressionRatio = isTextFile ? 0.3 : 0.8;
    return sum + (file.size * compressionRatio);
  }, 0);

  return {
    estimatedSize: Math.round(estimatedCompressedSize),
    compressionRatio: totalUncompressedSize > 0 ? 
      totalUncompressedSize / estimatedCompressedSize : 1,
  };
}
