import JSZip from "jszip";
import type { FileEntry } from "../types";

// Simple ID generator
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2);

/**
 * Maximum size of zip file in bytes
 * 100 MB = 100 * 1024 * 1024 bytes
 */
export const MAX_ZIP_SIZE = 100 * 1024 * 1024;

/**
 * Process a zip file and extract its contents
 * @param file The zip file to process
 * @returns A list of files contained in the zip
 */
export async function processZipFile(file: File): Promise<FileEntry[]> {
  // Validate file size
  if (file.size > MAX_ZIP_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed (${formatFileSize(MAX_ZIP_SIZE)})`
    );
  }

  // Read the zip file
  const zip = await JSZip.loadAsync(file);
  const fileEntries: FileEntry[] = [];

  // Process each file in the zip
  const promises = Object.keys(zip.files).map(async (filename) => {
    const zipEntry = zip.files[filename];

    // Skip directories
    if (zipEntry.dir) {
      return;
    }

    try {
      // Get the file as a Blob
      const blob = await zipEntry.async("blob");

      fileEntries.push({
        id: generateId(),
        name: getFileName(filename),
        path: filename,
        size: blob.size,
        type: getFileType(filename),
        blob,
      });
    } catch (error) {
      console.error(`Error extracting ${filename}:`, error);
      // Continue with other files
    }
  });

  // Wait for all files to be processed
  await Promise.all(promises);

  return fileEntries;
}

/**
 * Create a new zip file containing only safe files
 * @param files List of file entries to include in the zip
 * @returns Blob representing the zip file
 */
export async function createSafeZip(files: FileEntry[]): Promise<Blob> {
  const zip = new JSZip();

  // Add each file to the zip
  files.forEach((file) => {
    if (file.blob) {
      zip.file(file.path, file.blob);
    }
  });

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
 * Get the file name from a path
 * @param path File path
 * @returns File name
 */
export function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * Get a simple file type based on extension
 * @param filename File name
 * @returns Simple file type description
 */
export function getFileType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  // Map of extensions to file types
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

    // Audio
    mp3: "Audio File",
    wav: "Audio File",
    ogg: "Audio File",

    // Video
    mp4: "Video File",
    avi: "Video File",
    mov: "Video File",
    wmv: "Video File",

    // Code
    html: "HTML File",
    css: "CSS File",
    js: "JavaScript File",
    ts: "TypeScript File",
    jsx: "React Component",
    tsx: "React TypeScript Component",
    json: "JSON File",
    xml: "XML File",
    py: "Python Script",
    java: "Java Source File",
    c: "C Source File",
    cpp: "C++ Source File",
    cs: "C# Source File",
    php: "PHP Script",
    rb: "Ruby Script",
    go: "Go Source File",
    rs: "Rust Source File",

    // Executables
    exe: "Windows Executable",
    dll: "Windows Library",
    app: "macOS Application",
    apk: "Android Package",
    deb: "Debian Package",
    rpm: "RPM Package",

    // Archives
    zip: "ZIP Archive",
    rar: "RAR Archive",
    "7z": "7-Zip Archive",
    tar: "TAR Archive",
    gz: "GZip Archive",
    bz2: "BZip2 Archive",
  };

  return extensionMap[extension] || "Unknown File";
}

/**
 * Format file size in human-readable format
 * @param bytes File size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
