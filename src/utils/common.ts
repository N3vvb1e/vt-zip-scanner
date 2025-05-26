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

// getFileName function removed as it was unused

/**
 * Detect file type from magic numbers (file signatures)
 * @param buffer - The first few bytes of the file
 * @returns Detected file type or null if not recognized
 */
function detectFileTypeFromMagicNumbers(buffer: Uint8Array): string | null {
  // Convert first 16 bytes to hex string for easier matching
  const hex = Array.from(buffer.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Check for common file signatures
  const signatures: Record<string, string> = {
    // Executables
    "4d5a": "MS-DOS Executable", // MZ header (DOS/Windows executables)
    "7f454c46": "Linux Executable", // ELF header
    cafebabe: "Java Class File", // Java bytecode
    feedface: "macOS Executable", // Mach-O 32-bit
    feedfacf: "macOS Executable", // Mach-O 64-bit
    cefaedfe: "macOS Executable", // Mach-O reverse byte order

    // Images
    ffd8ff: "JPEG Image",
    "89504e47": "PNG Image",
    "47494638": "GIF Image",
    "424d": "Bitmap Image",
    "49492a00": "TIFF Image",
    "4d4d002a": "TIFF Image",

    // Documents
    "25504446": "PDF Document",
    d0cf11e0: "Microsoft Office Document",
    "504b0304": "ZIP Archive", // Also used by Office 2007+ formats
    "504b0506": "ZIP Archive",
    "504b0708": "ZIP Archive",

    // Archives
    "1f8b08": "Gzip Archive",
    "425a68": "Bzip2 Archive",
    fd377a58: "XZ Archive",
    "377abcaf": "7-Zip Archive",
    "526172211a07": "RAR Archive",

    // Audio/Video
    "494433": "MP3 Audio", // ID3 tag
    fff3: "MP3 Audio", // MPEG-1 Layer 3
    fff2: "MP3 Audio", // MPEG-2 Layer 3
    "52494646": "RIFF Container", // RIFF container (WAV, AVI, WebP)
    "000001ba": "MPEG Video",
    "000001b3": "MPEG Video",
    "66747970": "MP4 Video",

    // Other
    "7573746172": "TAR Archive",
    cafed00d: "Java Archive",
    "1a45dfa3": "Matroska Video",
  };

  // Check signatures
  for (const [signature, type] of Object.entries(signatures)) {
    if (hex.startsWith(signature.toLowerCase())) {
      // Special handling for RIFF containers
      if (signature === "52494646" && buffer.length >= 12) {
        const riffType = Array.from(buffer.slice(8, 12))
          .map((b) => String.fromCharCode(b))
          .join("");

        if (riffType === "WEBP") return "WebP Image";
        if (riffType === "WAVE") return "WAV Audio";
        if (riffType === "AVI ") return "AVI Video";
        return "RIFF Container";
      }

      // Special handling for ZIP-based formats
      if (
        signature === "504b0304" ||
        signature === "504b0506" ||
        signature === "504b0708"
      ) {
        // Could be ZIP or Office document - return generic for now
        return "ZIP-based Archive";
      }

      return type;
    }
  }

  // Check for text files (ASCII/UTF-8)
  if (isTextFile(buffer)) {
    return "Text File";
  }

  return null;
}

/**
 * Check if file appears to be a text file
 * @param buffer - File content buffer
 * @returns True if file appears to be text
 */
function isTextFile(buffer: Uint8Array): boolean {
  if (buffer.length === 0) return false;

  // Check first 1024 bytes or entire file if smaller
  const sampleSize = Math.min(1024, buffer.length);
  const sample = buffer.slice(0, sampleSize);

  let textBytes = 0;
  const totalBytes = sample.length;

  for (const byte of sample) {
    // Count printable ASCII characters, tabs, newlines, carriage returns
    if (
      (byte >= 32 && byte <= 126) ||
      byte === 9 ||
      byte === 10 ||
      byte === 13
    ) {
      textBytes++;
    } else if (byte === 0) {
      // Null bytes strongly suggest binary file
      return false;
    }
  }

  // If more than 95% of bytes are text characters, consider it text
  return textBytes / totalBytes > 0.95;
}

/**
 * Get file type based on extension and optionally file content
 * @param filename - The filename to analyze
 * @param blob - Optional file blob for content analysis
 * @returns A human-readable file type
 */
export async function getFileType(
  filename: string,
  blob?: Blob
): Promise<string> {
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
    odt: "OpenDocument Text",
    ods: "OpenDocument Spreadsheet",
    odp: "OpenDocument Presentation",
    csv: "CSV File",
    md: "Markdown File",
    readme: "README File",

    // Images
    jpg: "JPEG Image",
    jpeg: "JPEG Image",
    png: "PNG Image",
    gif: "GIF Image",
    bmp: "Bitmap Image",
    svg: "SVG Vector Image",
    webp: "WebP Image",
    ico: "Icon File",
    tiff: "TIFF Image",
    tif: "TIFF Image",
    psd: "Photoshop Document",
    ai: "Adobe Illustrator File",

    // Audio/Video
    mp3: "MP3 Audio",
    wav: "WAV Audio",
    flac: "FLAC Audio",
    aac: "AAC Audio",
    ogg: "OGG Audio",
    m4a: "M4A Audio",
    mp4: "MP4 Video",
    avi: "AVI Video",
    mkv: "MKV Video",
    mov: "QuickTime Video",
    wmv: "WMV Video",
    flv: "Flash Video",
    webm: "WebM Video",

    // Web Development
    html: "HTML File",
    htm: "HTML File",
    css: "CSS Stylesheet",
    scss: "SCSS Stylesheet",
    sass: "Sass Stylesheet",
    less: "Less Stylesheet",
    js: "JavaScript File",
    jsx: "React JSX File",
    ts: "TypeScript File",
    tsx: "React TSX File",
    vue: "Vue Component",
    php: "PHP Script",
    asp: "ASP File",
    aspx: "ASP.NET File",
    jsp: "JSP File",

    // Programming Languages
    py: "Python Script",
    java: "Java Source",
    class: "Java Class",
    c: "C Source",
    cpp: "C++ Source",
    cxx: "C++ Source",
    cc: "C++ Source",
    h: "C/C++ Header",
    hpp: "C++ Header",
    cs: "C# Source",
    vb: "Visual Basic",
    rb: "Ruby Script",
    go: "Go Source",
    rs: "Rust Source",
    swift: "Swift Source",
    kt: "Kotlin Source",
    scala: "Scala Source",
    pl: "Perl Script",
    sh: "Shell Script",
    bash: "Bash Script",
    bat: "Batch File",
    cmd: "Command File",
    ps1: "PowerShell Script",

    // Data & Configuration
    json: "JSON Data",
    xml: "XML Document",
    yaml: "YAML File",
    yml: "YAML File",
    toml: "TOML File",
    ini: "INI Configuration",
    cfg: "Configuration File",
    conf: "Configuration File",
    config: "Configuration File",
    env: "Environment File",
    properties: "Properties File",
    sql: "SQL Script",
    db: "Database File",
    sqlite: "SQLite Database",

    // Executables & Libraries
    exe: "Windows Executable",
    msi: "Windows Installer",
    dll: "Windows Library",
    so: "Linux Library",
    dylib: "macOS Library",
    app: "macOS Application",
    dmg: "macOS Disk Image",
    pkg: "macOS Package",
    deb: "Debian Package",
    rpm: "RPM Package",
    apk: "Android Package",
    ipa: "iOS Package",

    // Archives & Compression
    zip: "ZIP Archive",
    rar: "RAR Archive",
    "7z": "7-Zip Archive",
    tar: "TAR Archive",
    gz: "Gzip Archive",
    bz2: "Bzip2 Archive",
    xz: "XZ Archive",
    iso: "ISO Image",

    // Fonts
    ttf: "TrueType Font",
    otf: "OpenType Font",
    woff: "Web Font",
    woff2: "Web Font 2",
    eot: "Embedded Font",

    // Other Common Files
    log: "Log File",
    tmp: "Temporary File",
    bak: "Backup File",
    old: "Old File",
    lock: "Lock File",
    pid: "Process ID File",
    key: "Key File",
    pem: "PEM Certificate",
    crt: "Certificate File",
    cer: "Certificate File",
    p12: "PKCS#12 Certificate",
    jks: "Java Keystore",

    // DOS/Legacy extensions (no extension)
    com: "MS-DOS Executable",
  };

  // First, try extension-based detection
  if (extension && extensionMap[extension]) {
    return extensionMap[extension];
  }

  // If no extension or unknown extension, try content-based detection
  if (blob) {
    try {
      // Read first 512 bytes for magic number detection
      const arrayBuffer = await blob.slice(0, 512).arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const detectedType = detectFileTypeFromMagicNumbers(buffer);
      if (detectedType) {
        return detectedType;
      }
    } catch (error) {
      console.warn("Failed to analyze file content:", error);
    }
  }

  return "Unknown File";
}

// Removed unused functions: getFileTypeSync, sleep, debounce
// These functions were exported but never used in the codebase

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
