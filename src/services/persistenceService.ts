import type { ScanTask } from "../types";

const DB_NAME = "VirusTotalScanner";
const DB_VERSION = 1;

// Object stores
const STORES = {
  QUEUE: "queue",
  HISTORY: "history",
  FILES: "files", // Store file blobs separately
  SETTINGS: "settings",
} as const;

// History retention (30 days by default)
const DEFAULT_HISTORY_RETENTION_DAYS = 30;

export interface HistoryEntry extends Omit<ScanTask, "file"> {
  fileId: string; // Reference to file in files store
  fileName: string;
  fileSize: number;
  fileType: string;
  completedAt?: Date;
  zipFileName?: string; // Track which ZIP this came from
}

export interface Settings {
  historyRetentionDays: number;
  autoStartScanning: boolean;
  lastCleanup: Date;
}

export interface SearchOptions {
  query?: string;
  status?: ScanTask["status"];
  dateFrom?: Date;
  dateTo?: Date;
  hasThreats?: boolean;
  limit?: number;
  offset?: number;
}

export class PersistenceService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.openDatabase();
    await this.initPromise;
  }

  /**
   * Open IndexedDB database
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(new Error("Failed to open database"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("IndexedDB opened successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(STORES.QUEUE)) {
          const queueStore = db.createObjectStore(STORES.QUEUE, {
            keyPath: "id",
          });
          queueStore.createIndex("status", "status", { unique: false });
          queueStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          const historyStore = db.createObjectStore(STORES.HISTORY, {
            keyPath: "id",
          });
          historyStore.createIndex("status", "status", { unique: false });
          historyStore.createIndex("createdAt", "createdAt", { unique: false });
          historyStore.createIndex("completedAt", "completedAt", {
            unique: false,
          });
          historyStore.createIndex("fileName", "fileName", { unique: false });
          historyStore.createIndex("zipFileName", "zipFileName", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains(STORES.FILES)) {
          db.createObjectStore(STORES.FILES, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, {
            keyPath: "key",
          });

          // Add default settings
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore(STORES.SETTINGS);

          store.add({
            key: "general",
            historyRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
            autoStartScanning: true,
            lastCleanup: new Date(),
          });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  // ========== Queue Operations ==========

  /**
   * Save current queue state
   */
  async saveQueue(tasks: ScanTask[]): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(
      [STORES.QUEUE, STORES.FILES],
      "readwrite"
    );
    const queueStore = transaction.objectStore(STORES.QUEUE);
    const filesStore = transaction.objectStore(STORES.FILES);

    // Clear existing queue
    await this.clearStore(queueStore);

    // Save each task
    for (const task of tasks) {
      try {
        // Save file blob separately if it exists
        if (task.file.blob) {
          await this.putRequest(filesStore, {
            id: task.file.id,
            blob: task.file.blob,
            metadata: {
              name: task.file.name,
              size: task.file.size,
              type: task.file.type,
              path: task.file.path,
            },
          });
          console.log(`Saved blob for task ${task.id}, file ${task.file.name}`);
        }

        // Save task without blob
        const taskToSave = {
          ...task,
          file: {
            ...task.file,
            blob: undefined, // Don't store blob in queue
          },
        };
        await this.putRequest(queueStore, taskToSave);
        console.log(`Saved task ${task.id} to queue`);
      } catch (error) {
        console.error(`Error saving task ${task.id}:`, error);
        // Continue with other tasks even if one fails
      }
    }

    await this.completeTransaction(transaction);
  }

  /**
   * Load queue state
   */
  async loadQueue(): Promise<ScanTask[]> {
    const db = await this.ensureDb();
    const transaction = db.transaction(
      [STORES.QUEUE, STORES.FILES],
      "readonly"
    );
    const queueStore = transaction.objectStore(STORES.QUEUE);
    const filesStore = transaction.objectStore(STORES.FILES);

    const tasks = await this.getAllFromStore<ScanTask>(queueStore);
    console.log(`Found ${tasks.length} tasks in queue store`);

    // Restore file blobs
    const validTasks: ScanTask[] = [];
    for (const task of tasks) {
      try {
        console.log(
          `Loading blob for task ${task.id}, file ${task.file.name}, fileId: ${task.file.id}`
        );
        const fileData = await this.getRequest(filesStore, task.file.id);
        console.log(
          `File data for ${task.file.id}:`,
          fileData ? "found" : "not found"
        );

        if (fileData?.blob) {
          task.file.blob = fileData.blob;
          validTasks.push(task);
          console.log(`✓ Task ${task.id} loaded successfully with blob`);
        } else {
          console.warn(
            `Missing blob for task ${task.id}, file ${task.file.name}. File data:`,
            fileData
          );
          // For completed tasks, we can still show them even without blobs for download
          if (task.status === "completed" || task.status === "error") {
            console.log(
              `Including completed task ${task.id} without blob for display`
            );
            validTasks.push(task);
          }
        }
      } catch (error) {
        console.error(`Error loading blob for task ${task.id}:`, error);
        // For completed tasks, include them anyway for display
        if (task.status === "completed" || task.status === "error") {
          console.log(`Including completed task ${task.id} despite blob error`);
          validTasks.push(task);
        }
      }
    }

    // Sort by creation date
    validTasks.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    console.log(
      `Loaded ${validTasks.length} valid tasks out of ${tasks.length} total tasks`
    );
    return validTasks;
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction([STORES.QUEUE], "readwrite");
    const queueStore = transaction.objectStore(STORES.QUEUE);

    await this.clearStore(queueStore);
    await this.completeTransaction(transaction);
  }

  // ========== History Operations ==========

  /**
   * Add completed task to history
   */
  async addToHistory(task: ScanTask): Promise<void> {
    if (
      task.status !== "completed" &&
      task.status !== "error" &&
      task.status !== "reused"
    ) {
      return; // Only store completed, errored, or reused tasks
    }

    const db = await this.ensureDb();
    const transaction = db.transaction(
      [STORES.HISTORY, STORES.FILES],
      "readwrite"
    );
    const historyStore = transaction.objectStore(STORES.HISTORY);
    const filesStore = transaction.objectStore(STORES.FILES);

    // Store file if needed and it's marked as safe
    if (
      task.file.blob &&
      (task.status === "completed" || task.status === "reused") &&
      (!task.report?.stats.malicious || task.report.stats.malicious === 0)
    ) {
      await this.putRequest(filesStore, {
        id: task.file.id,
        blob: task.file.blob,
        metadata: {
          name: task.file.name,
          size: task.file.size,
          type: task.file.type,
          path: task.file.path,
        },
      });
    }

    // Create history entry
    const historyEntry: HistoryEntry = {
      id: task.id,
      fileId: task.file.id,
      fileName: task.file.name,
      fileSize: task.file.size,
      fileType: task.file.type,
      status: task.status,
      progress: task.progress,
      error: task.error,
      analysisId: task.analysisId,
      report: task.report,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: new Date(),
      zipFileName: (task as ScanTask & { zipFileName?: string }).zipFileName, // If tracking source ZIP
    };

    console.log(
      `💾 Saving to history: ${task.file.name} (${
        task.status
      }) - has report: ${!!task.report}, has file_info: ${!!task.report?.meta
        ?.file_info}`
    );

    // Debug: Log the actual report structure to understand the API response
    if (task.report) {
      console.log(`  🔍 Report structure:`, {
        id: task.report.id,
        stats: task.report.stats,
        meta: task.report.meta,
        hasResults: !!task.report.results,
        resultKeys: task.report.results
          ? Object.keys(task.report.results).slice(0, 3)
          : [],
      });
    }

    if (task.report?.meta?.file_info) {
      console.log(
        `  📋 File info: SHA256=${task.report.meta.file_info.sha256.substring(
          0,
          16
        )}..., size=${task.report.meta.file_info.size}`
      );
    }

    await this.putRequest(historyStore, historyEntry);
    await this.completeTransaction(transaction);

    // Run cleanup if needed
    await this.cleanupOldHistory();
  }

  /**
   * Get history entries with search and pagination
   */
  async getHistory(options: SearchOptions = {}): Promise<{
    entries: HistoryEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const db = await this.ensureDb();
    const transaction = db.transaction([STORES.HISTORY], "readonly");
    const store = transaction.objectStore(STORES.HISTORY);

    let entries: HistoryEntry[] = [];

    // Use index if searching by status
    if (options.status) {
      const index = store.index("status");
      const range = IDBKeyRange.only(options.status);
      entries = await this.getAllFromIndex<HistoryEntry>(index, range);
    } else {
      entries = await this.getAllFromStore<HistoryEntry>(store);
    }

    // Apply filters
    entries = entries.filter((entry) => {
      // Text search
      if (options.query) {
        const query = options.query.toLowerCase();
        if (!entry.fileName.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Date range
      if (options.dateFrom && new Date(entry.createdAt) < options.dateFrom) {
        return false;
      }
      if (options.dateTo && new Date(entry.createdAt) > options.dateTo) {
        return false;
      }

      // Threat filter
      if (options.hasThreats !== undefined) {
        if (
          (entry.status === "completed" || entry.status === "reused") &&
          entry.report?.stats
        ) {
          const maliciousCount = entry.report.stats.malicious || 0;
          const hasThreat = maliciousCount > 0;

          if (options.hasThreats !== hasThreat) {
            return false;
          }
        } else {
          // For non-completed/reused entries or entries without reports:
          // - If looking for threats (hasThreats = true), exclude these entries
          // - If looking for safe files (hasThreats = false), exclude these entries
          // Only completed/reused scans with reports can be classified as safe or threats
          return false;
        }
      }

      return true;
    });

    // Sort by completed date (newest first)
    entries.sort((a, b) => {
      const dateA = new Date(a.completedAt || a.createdAt).getTime();
      const dateB = new Date(b.completedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    const total = entries.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;

    entries = entries.slice(offset, offset + limit);

    return {
      entries,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get a file from history
   */
  async getHistoryFile(fileId: string): Promise<Blob | null> {
    const db = await this.ensureDb();
    const transaction = db.transaction([STORES.FILES], "readonly");
    const store = transaction.objectStore(STORES.FILES);

    const fileData = await this.getRequest(store, fileId);
    return fileData?.blob || null;
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(
      [STORES.HISTORY, STORES.FILES, STORES.QUEUE],
      "readwrite"
    );

    // Clear history entries
    await this.clearStore(transaction.objectStore(STORES.HISTORY));

    // Clear all file blobs (both from history and queue)
    await this.clearStore(transaction.objectStore(STORES.FILES));

    // Also clear any remaining queue items to prevent orphaned files
    await this.clearStore(transaction.objectStore(STORES.QUEUE));

    await this.completeTransaction(transaction);
    console.log("History, files, and queue cleared successfully");
  }

  /**
   * Clean up old history entries
   */
  private async cleanupOldHistory(): Promise<void> {
    const settings = await this.getSettings();
    const lastCleanup = new Date(settings.lastCleanup);
    const now = new Date();

    // Only run cleanup once per day
    if (now.getTime() - lastCleanup.getTime() < 24 * 60 * 60 * 1000) {
      return;
    }

    const db = await this.ensureDb();
    const transaction = db.transaction(
      [STORES.HISTORY, STORES.FILES, STORES.SETTINGS],
      "readwrite"
    );
    const historyStore = transaction.objectStore(STORES.HISTORY);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.historyRetentionDays);

    // Get old entries
    const allEntries = await this.getAllFromStore<HistoryEntry>(historyStore);
    const entriesToDelete = allEntries.filter(
      (entry) => new Date(entry.completedAt || entry.createdAt) < cutoffDate
    );

    // Delete old entries and their files
    const fileIdsToCheck = new Set<string>();
    for (const entry of entriesToDelete) {
      await this.deleteRequest(historyStore, entry.id);
      fileIdsToCheck.add(entry.fileId);
    }

    // Check if files are still referenced
    const remainingEntries = await this.getAllFromStore<HistoryEntry>(
      historyStore
    );
    const referencedFileIds = new Set(remainingEntries.map((e) => e.fileId));

    const filesStore = transaction.objectStore(STORES.FILES);
    for (const fileId of fileIdsToCheck) {
      if (!referencedFileIds.has(fileId)) {
        await this.deleteRequest(filesStore, fileId);
      }
    }

    // Update last cleanup date
    await this.updateSettings({ lastCleanup: now });

    await this.completeTransaction(transaction);
    console.log(`Cleaned up ${entriesToDelete.length} old history entries`);
  }

  // ========== Settings Operations ==========

  /**
   * Get settings
   */
  async getSettings(): Promise<Settings> {
    const db = await this.ensureDb();
    const transaction = db.transaction([STORES.SETTINGS], "readonly");
    const store = transaction.objectStore(STORES.SETTINGS);

    const settings = await this.getRequest(store, "general");
    return (
      (settings as unknown as Settings) || {
        historyRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
        autoStartScanning: true,
        lastCleanup: new Date(),
      }
    );
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<Settings>): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction([STORES.SETTINGS], "readwrite");
    const store = transaction.objectStore(STORES.SETTINGS);

    // Get current settings within the same transaction
    const current = await this.getRequest(store, "general");
    const currentSettings = (current as unknown as Settings) || {
      historyRetentionDays: DEFAULT_HISTORY_RETENTION_DAYS,
      autoStartScanning: true,
      lastCleanup: new Date(),
    };

    const updated = { ...currentSettings, ...updates, key: "general" };

    await this.putRequest(store, updated);
    await this.completeTransaction(transaction);
  }

  // ========== Utility Methods ==========

  /**
   * Get all records from a store
   */
  private getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all records from an index
   */
  private getAllFromIndex<T>(
    index: IDBIndex,
    range?: IDBKeyRange
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = range ? index.getAll(range) : index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single record
   */
  private getRequest(
    store: IDBObjectStore,
    key: string
  ): Promise<{
    id: string;
    blob?: Blob;
    metadata?: {
      name: string;
      size: number;
      type: string;
      path: string;
    };
    [key: string]: unknown;
  } | null> {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Put a record
   */
  private putRequest(store: IDBObjectStore, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a record
   */
  private deleteRequest(store: IDBObjectStore, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all records from a store
   */
  private clearStore(store: IDBObjectStore): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Complete a transaction
   */
  private completeTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Export all data (for backup)
   */
  async exportData(): Promise<{
    queue: ScanTask[];
    history: HistoryEntry[];
    settings: Settings;
    exportDate: Date;
  }> {
    const queue = await this.loadQueue();
    const { entries: history } = await this.getHistory({ limit: 10000 });
    const settings = await this.getSettings();

    return {
      queue,
      history,
      settings,
      exportDate: new Date(),
    };
  }

  /**
   * Find existing scan result by file hash
   * @param sha256 - The SHA-256 hash of the file
   * @param size - The file size for additional verification
   * @returns The existing history entry if found, null otherwise
   */
  async findExistingScan(
    sha256: string,
    size: number
  ): Promise<HistoryEntry | null> {
    const db = await this.ensureDb();
    const transaction = db.transaction([STORES.HISTORY], "readonly");
    const store = transaction.objectStore(STORES.HISTORY);

    try {
      const allEntries = await this.getAllFromStore<HistoryEntry>(store);
      console.log(
        `🔍 Searching ${
          allEntries.length
        } history entries for SHA256: ${sha256.substring(
          0,
          16
        )}... (size: ${size})`
      );

      // Find entry with matching SHA-256 hash and size
      const matchingEntry = allEntries.find((entry) => {
        const statusMatch =
          entry.status === "completed" || entry.status === "reused";

        if (!statusMatch) {
          return false;
        }

        if (!entry.report?.meta?.file_info) {
          return false;
        }

        const fileInfo = entry.report.meta.file_info;
        const hashMatch = fileInfo.sha256 === sha256;
        const sizeMatch = fileInfo.size === size;

        return hashMatch && sizeMatch && statusMatch;
      });

      if (matchingEntry) {
        console.log(
          `  ✅ Found matching entry: ${matchingEntry.id} (${matchingEntry.fileName})`
        );
      } else {
        console.log(`  ❌ No matching entry found`);
      }

      await this.completeTransaction(transaction);
      return matchingEntry || null;
    } catch (error) {
      console.error("Error finding existing scan:", error);
      return null;
    }
  }

  /**
   * Clean up history entries that don't have proper file_info for duplicate detection
   * This removes old entries that can't be used for hash-based duplicate detection
   */
  async cleanupInvalidHistoryEntries(): Promise<number> {
    const db = await this.ensureDb();
    const transaction = db.transaction([STORES.HISTORY], "readwrite");
    const store = transaction.objectStore(STORES.HISTORY);

    try {
      const allEntries = await this.getAllFromStore<HistoryEntry>(store);

      // Find entries without proper file_info
      const invalidEntries = allEntries.filter(
        (entry) =>
          !entry.report?.meta?.file_info ||
          !entry.report.meta.file_info.sha256 ||
          !entry.report.meta.file_info.size
      );

      // Delete invalid entries
      for (const entry of invalidEntries) {
        await this.deleteRequest(store, entry.id);
      }

      await this.completeTransaction(transaction);

      return invalidEntries.length;
    } catch (error) {
      console.error("Error cleaning up invalid history entries:", error);
      return 0;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    queueCount: number;
    historyCount: number;
    filesCount: number;
    estimatedSize?: number;
    actualFileSize?: number;
  }> {
    const db = await this.ensureDb();
    const transaction = db.transaction(
      [STORES.QUEUE, STORES.HISTORY, STORES.FILES],
      "readonly"
    );

    const queueCount = await this.countRecords(
      transaction.objectStore(STORES.QUEUE)
    );
    const historyCount = await this.countRecords(
      transaction.objectStore(STORES.HISTORY)
    );
    const filesCount = await this.countRecords(
      transaction.objectStore(STORES.FILES)
    );

    // Calculate actual file size by summing blob sizes
    let actualFileSize = 0;
    try {
      const filesStore = transaction.objectStore(STORES.FILES);
      const allFiles = await this.getAllFromStore<{
        id: string;
        blob?: Blob;
        metadata?: { size: number };
      }>(filesStore);

      actualFileSize = allFiles.reduce((total, file) => {
        if (file.blob) {
          return total + file.blob.size;
        } else if (file.metadata?.size) {
          return total + file.metadata.size;
        }
        return total;
      }, 0);
    } catch (error) {
      console.warn("Failed to calculate actual file size:", error);
    }

    let estimatedSize: number | undefined;
    if ("estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      estimatedSize = estimate.usage;
    }

    return {
      queueCount,
      historyCount,
      filesCount,
      estimatedSize,
      actualFileSize,
    };
  }

  /**
   * Count records in a store
   */
  private countRecords(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const persistenceService = new PersistenceService();
