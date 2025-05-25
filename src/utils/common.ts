/**
 * Common utility functions shared across the application
 */

/**
 * Generate a unique ID using timestamp and random string
 * @returns A unique string ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Format file size in human-readable format
 * @param bytes - The size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Get the file name from a path
 * @param path - The file path
 * @returns The file name
 */
export function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * Get a simple file type based on extension
 * @param filename - The filename to analyze
 * @returns A human-readable file type
 */
export function getFileType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  const extensionMap: Record<string, string> = {
    // Documents
    pdf: "PDF Document",
    doc: "Word Document",
    docx: "Word Document",
    xls: "Excel Spreadsheet",
    xlsx: "Excel Spreadsheet",
    ppt: "PowerPoint Presentation",
    pptx: "PowerPoint Presentation",
    txt: "Text File",
    rtf: "Rich Text File",

    // Images
    jpg: "Image",
    jpeg: "Image",
    png: "Image",
    gif: "Image",
    bmp: "Image",
    svg: "Vector Image",

    // Audio/Video
    mp3: "Audio File",
    wav: "Audio File",
    mp4: "Video File",
    avi: "Video File",

    // Code
    html: "HTML File",
    css: "CSS File",
    js: "JavaScript File",
    ts: "TypeScript File",
    json: "JSON File",
    xml: "XML File",
    py: "Python Script",

    // Executables (marked for extra attention)
    exe: "Windows Executable",
    dll: "Windows Library",
    app: "macOS Application",
    apk: "Android Package",

    // Archives
    zip: "ZIP Archive",
    rar: "RAR Archive",
    "7z": "7-Zip Archive",
  };

  return extensionMap[extension] || "Unknown File";
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce a function call
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns The debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Calculate SHA-256 hash of a file
 * @param file - The file blob to hash
 * @returns Promise that resolves to the hex-encoded hash
 */
export async function calculateFileHash(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Calculate multiple hashes for a file (SHA-256, MD5 simulation)
 * Note: Web Crypto API doesn't support MD5, so we'll use SHA-256 as primary identifier
 * @param file - The file blob to hash
 * @returns Promise that resolves to hash information
 */
export async function calculateFileHashes(file: Blob): Promise<{
  sha256: string;
  size: number;
}> {
  const sha256 = await calculateFileHash(file);
  return {
    sha256,
    size: file.size,
  };
}
