// File types
export interface FileEntry {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  blob?: Blob;
  sha256?: string; // File hash for duplicate detection
}

// Task states
export type TaskStatus =
  | "pending" // In queue, not yet started
  | "hashing" // Calculating file hash for duplicate detection
  | "uploading" // Uploading to VirusTotal
  | "scanning" // Scanning on VirusTotal
  | "completed" // Scan completed
  | "reused" // Reused existing scan result
  | "error"; // Error occurred

// Queue task
export interface ScanTask {
  id: string;
  file: FileEntry;
  status: TaskStatus;
  progress: number;
  error?: string;
  analysisId?: string;
  report?: AnalysisReport;
  createdAt: Date;
  updatedAt: Date;
}

// VirusTotal API types
export interface AnalysisReport {
  id: string;
  stats: {
    harmless: number;
    malicious: number;
    suspicious: number;
    undetected: number;
    timeout: number;
  };
  results: Record<string, EngineResult>;
  meta: {
    file_info: {
      sha256: string;
      sha1: string;
      md5: string;
      size: number;
      file_type: string;
      filename: string;
    };
  };
}

export interface EngineResult {
  category: string;
  engine_name: string;
  engine_version?: string;
  result?: string;
  method?: string;
  engine_update?: string;
}

// API response types
export interface SubmitFileResponse {
  data: {
    id: string;
    type: string;
  };
}

// Queue context types
export interface QueueContextType {
  tasks: ScanTask[];
  addTask: (file: FileEntry) => void;
  removeTask: (id: string) => void;
  clearQueue: () => void;
  isProcessing: boolean;
  startProcessing: () => void;
  stopProcessing: () => void;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}
