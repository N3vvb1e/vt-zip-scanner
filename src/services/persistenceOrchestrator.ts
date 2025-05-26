/**
 * Persistence Orchestrator
 * Orchestrates all persistence operations using focused repositories
 */

import type { ScanTask } from "../types";
import { databaseManager } from "./database/databaseManager";
import {
  QueueRepository,
  type QueueRepositoryInterface,
} from "./repositories/queueRepository";
import {
  HistoryRepository,
  type HistoryRepositoryInterface,
  type HistoryEntry,
  type SearchOptions,
} from "./repositories/historyRepository";
import {
  SettingsRepository,
  type SettingsRepositoryInterface,
  type Settings,
} from "./repositories/settingsRepository";
import {
  FileRepository,
  type FileRepositoryInterface,
} from "./repositories/fileRepository";

export interface PersistenceOrchestratorInterface {
  // Initialization
  init(): Promise<void>;

  // Queue operations
  saveQueue(tasks: ScanTask[]): Promise<void>;
  loadQueue(): Promise<ScanTask[]>;
  clearQueue(): Promise<void>;

  // History operations
  addToHistory(task: ScanTask): Promise<void>;
  getHistory(options?: SearchOptions): Promise<{
    entries: HistoryEntry[];
    total: number;
    hasMore: boolean;
  }>;
  findExistingScan(sha256: string, size: number): Promise<HistoryEntry | null>;
  deleteHistoryEntry(entryId: string): Promise<void>;
  deleteHistoryEntries(entryIds: string[]): Promise<void>;
  clearHistory(): Promise<void>;

  // File operations
  getHistoryFile(fileId: string): Promise<Blob | null>;

  // Settings operations
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<Settings>): Promise<void>;

  // Utility operations
  exportData(): Promise<{
    queue: ScanTask[];
    history: HistoryEntry[];
    settings: Settings;
    exportDate: Date;
  }>;
  getStorageStats(): Promise<{
    queueCount: number;
    historyCount: number;
    filesCount: number;
    estimatedSize?: number;
    actualFileSize?: number;
  }>;
  cleanupInvalidHistoryEntries(): Promise<number>;
}

/**
 * Persistence orchestrator that coordinates all database operations
 */
export class PersistenceOrchestrator
  implements PersistenceOrchestratorInterface
{
  private queueRepo: QueueRepositoryInterface;
  private historyRepo: HistoryRepositoryInterface;
  private settingsRepo: SettingsRepositoryInterface;
  private fileRepo: FileRepositoryInterface;

  constructor(
    queueRepo?: QueueRepositoryInterface,
    historyRepo?: HistoryRepositoryInterface,
    settingsRepo?: SettingsRepositoryInterface,
    fileRepo?: FileRepositoryInterface
  ) {
    this.queueRepo = queueRepo || new QueueRepository();
    this.historyRepo = historyRepo || new HistoryRepository();
    this.settingsRepo = settingsRepo || new SettingsRepository();
    this.fileRepo = fileRepo || new FileRepository();
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    await databaseManager.init();
  }

  // ========== Queue Operations ==========

  async saveQueue(tasks: ScanTask[]): Promise<void> {
    return this.queueRepo.saveQueue(tasks);
  }

  async loadQueue(): Promise<ScanTask[]> {
    return this.queueRepo.loadQueue();
  }

  async clearQueue(): Promise<void> {
    return this.queueRepo.clearQueue();
  }

  // ========== History Operations ==========

  async addToHistory(task: ScanTask): Promise<void> {
    await this.historyRepo.addToHistory(task);

    // Run cleanup if needed
    await this.cleanupOldHistoryIfNeeded();
  }

  async getHistory(options?: SearchOptions): Promise<{
    entries: HistoryEntry[];
    total: number;
    hasMore: boolean;
  }> {
    return this.historyRepo.getHistory(options);
  }

  async findExistingScan(
    sha256: string,
    size: number
  ): Promise<HistoryEntry | null> {
    return this.historyRepo.findExistingScan(sha256, size);
  }

  async deleteHistoryEntry(entryId: string): Promise<void> {
    return this.historyRepo.deleteHistoryEntry(entryId);
  }

  async deleteHistoryEntries(entryIds: string[]): Promise<void> {
    return this.historyRepo.deleteHistoryEntries(entryIds);
  }

  async clearHistory(): Promise<void> {
    return this.historyRepo.clearHistory();
  }

  // ========== File Operations ==========

  async getHistoryFile(fileId: string): Promise<Blob | null> {
    return this.fileRepo.getFile(fileId);
  }

  // ========== Settings Operations ==========

  async getSettings(): Promise<Settings> {
    return this.settingsRepo.getSettings();
  }

  async updateSettings(updates: Partial<Settings>): Promise<void> {
    return this.settingsRepo.updateSettings(updates);
  }

  // ========== Utility Operations ==========

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

  async getStorageStats(): Promise<{
    queueCount: number;
    historyCount: number;
    filesCount: number;
    estimatedSize?: number;
    actualFileSize?: number;
  }> {
    const queue = await this.loadQueue();
    const { total: historyCount } = await this.getHistory({ limit: 1 });
    const { filesCount, totalSize } = await this.fileRepo.getStorageStats();

    let estimatedSize: number | undefined;
    if ("estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      estimatedSize = estimate.usage;
    }

    return {
      queueCount: queue.length,
      historyCount,
      filesCount,
      estimatedSize,
      actualFileSize: totalSize,
    };
  }

  async cleanupInvalidHistoryEntries(): Promise<number> {
    return this.historyRepo.cleanupInvalidHistoryEntries();
  }

  // ========== Private Methods ==========

  /**
   * Clean up old history entries if needed
   */
  private async cleanupOldHistoryIfNeeded(): Promise<void> {
    const settings = await this.getSettings();
    const lastCleanup = new Date(settings.lastCleanup);
    const now = new Date();

    // Only run cleanup once per day
    if (now.getTime() - lastCleanup.getTime() < 24 * 60 * 60 * 1000) {
      return;
    }

    const deletedCount = await this.historyRepo.cleanupOldHistory(
      settings.historyRetentionDays
    );

    // Update last cleanup date
    await this.updateSettings({ lastCleanup: now });

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old history entries`);
    }
  }
}

// Export singleton instance for backward compatibility
export const persistenceOrchestrator = new PersistenceOrchestrator();

// Legacy export name for backward compatibility
export const persistenceServiceV2 = persistenceOrchestrator;
