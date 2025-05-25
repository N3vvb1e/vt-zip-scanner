/**
 * History Repository
 * Handles history-related database operations
 */

import type { ScanTask } from "../../types";
import { BaseRepository } from "../database/baseRepository";
import { DB_CONFIG } from "../database/databaseManager";

export interface HistoryEntry extends Omit<ScanTask, "file"> {
  fileId: string; // Reference to file in files store
  fileName: string;
  fileSize: number;
  fileType: string;
  completedAt?: Date;
  zipFileName?: string; // Track which ZIP this came from
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

export interface HistoryRepositoryInterface {
  addToHistory(task: ScanTask): Promise<void>;
  getHistory(options?: SearchOptions): Promise<{
    entries: HistoryEntry[];
    total: number;
    hasMore: boolean;
  }>;
  findExistingScan(sha256: string, size: number): Promise<HistoryEntry | null>;
  clearHistory(): Promise<void>;
  cleanupOldHistory(retentionDays: number): Promise<number>;
  cleanupInvalidHistoryEntries(): Promise<number>;
}

export class HistoryRepository extends BaseRepository implements HistoryRepositoryInterface {
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

    await this.withWriteTransaction(
      [DB_CONFIG.STORES.HISTORY, DB_CONFIG.STORES.FILES],
      async (transaction) => {
        const historyStore = transaction.objectStore(DB_CONFIG.STORES.HISTORY);
        const filesStore = transaction.objectStore(DB_CONFIG.STORES.FILES);

        // Store file if needed and it's marked as safe
        if (
          task.file.blob &&
          (task.status === "completed" || task.status === "reused") &&
          (!task.report?.stats.malicious || task.report.stats.malicious === 0)
        ) {
          await this.putRecord(filesStore, {
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
          zipFileName: (task as ScanTask & { zipFileName?: string }).zipFileName,
        };

        console.log(
          `💾 Saving to history: ${task.file.name} (${
            task.status
          }) - has report: ${!!task.report}, has file_info: ${!!task.report?.meta
            ?.file_info}`
        );

        // Debug: Log the actual report structure
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

        await this.putRecord(historyStore, historyEntry);
      }
    );
  }

  /**
   * Get history entries with search and pagination
   */
  async getHistory(options: SearchOptions = {}): Promise<{
    entries: HistoryEntry[];
    total: number;
    hasMore: boolean;
  }> {
    return this.withReadTransaction([DB_CONFIG.STORES.HISTORY], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.HISTORY);

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
      entries = this.applyFilters(entries, options);

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
    });
  }

  /**
   * Apply search filters to entries
   */
  private applyFilters(entries: HistoryEntry[], options: SearchOptions): HistoryEntry[] {
    return entries.filter((entry) => {
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
          // Only completed/reused scans with reports can be classified as safe or threats
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Find existing scan result by file hash
   */
  async findExistingScan(sha256: string, size: number): Promise<HistoryEntry | null> {
    return this.withReadTransaction([DB_CONFIG.STORES.HISTORY], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.HISTORY);

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

          if (!statusMatch || !entry.report?.meta?.file_info) {
            return false;
          }

          const fileInfo = entry.report.meta.file_info;
          const hashMatch = fileInfo.sha256 === sha256;
          const sizeMatch = fileInfo.size === size;

          return hashMatch && sizeMatch;
        });

        if (matchingEntry) {
          console.log(
            `  ✅ Found matching entry: ${matchingEntry.id} (${matchingEntry.fileName})`
          );
        } else {
          console.log(`  ❌ No matching entry found`);
        }

        return matchingEntry || null;
      } catch (error) {
        console.error("Error finding existing scan:", error);
        return null;
      }
    });
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    await this.withWriteTransaction(
      [DB_CONFIG.STORES.HISTORY, DB_CONFIG.STORES.FILES, DB_CONFIG.STORES.QUEUE],
      async (transaction) => {
        // Clear history entries
        await this.clearStore(transaction.objectStore(DB_CONFIG.STORES.HISTORY));

        // Clear all file blobs (both from history and queue)
        await this.clearStore(transaction.objectStore(DB_CONFIG.STORES.FILES));

        // Also clear any remaining queue items to prevent orphaned files
        await this.clearStore(transaction.objectStore(DB_CONFIG.STORES.QUEUE));

        console.log("History, files, and queue cleared successfully");
      }
    );
  }

  /**
   * Clean up old history entries
   */
  async cleanupOldHistory(retentionDays: number): Promise<number> {
    return this.withWriteTransaction(
      [DB_CONFIG.STORES.HISTORY, DB_CONFIG.STORES.FILES],
      async (transaction) => {
        const historyStore = transaction.objectStore(DB_CONFIG.STORES.HISTORY);
        const filesStore = transaction.objectStore(DB_CONFIG.STORES.FILES);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // Get old entries
        const allEntries = await this.getAllFromStore<HistoryEntry>(historyStore);
        const entriesToDelete = allEntries.filter(
          (entry) => new Date(entry.completedAt || entry.createdAt) < cutoffDate
        );

        // Delete old entries and collect file IDs
        const fileIdsToCheck = new Set<string>();
        for (const entry of entriesToDelete) {
          await this.deleteRecord(historyStore, entry.id);
          fileIdsToCheck.add(entry.fileId);
        }

        // Check if files are still referenced
        const remainingEntries = await this.getAllFromStore<HistoryEntry>(historyStore);
        const referencedFileIds = new Set(remainingEntries.map((e) => e.fileId));

        // Delete unreferenced files
        for (const fileId of fileIdsToCheck) {
          if (!referencedFileIds.has(fileId)) {
            await this.deleteRecord(filesStore, fileId);
          }
        }

        console.log(`Cleaned up ${entriesToDelete.length} old history entries`);
        return entriesToDelete.length;
      }
    );
  }

  /**
   * Clean up history entries that don't have proper file_info for duplicate detection
   */
  async cleanupInvalidHistoryEntries(): Promise<number> {
    return this.withWriteTransaction([DB_CONFIG.STORES.HISTORY], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.HISTORY);

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
          await this.deleteRecord(store, entry.id);
        }

        return invalidEntries.length;
      } catch (error) {
        console.error("Error cleaning up invalid history entries:", error);
        return 0;
      }
    });
  }
}
