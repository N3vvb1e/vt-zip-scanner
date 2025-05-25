/**
 * Persistence Service
 * Backward-compatible wrapper that delegates to the PersistenceOrchestrator
 */

import type { ScanTask } from "../types";
import {
  persistenceOrchestrator,
  type PersistenceOrchestratorInterface,
} from "./persistenceOrchestrator";
import type {
  HistoryEntry,
  SearchOptions,
} from "./repositories/historyRepository";
import type { Settings } from "./repositories/settingsRepository";

// Re-export types for backward compatibility
export type {
  HistoryEntry,
  SearchOptions,
} from "./repositories/historyRepository";
export type { Settings } from "./repositories/settingsRepository";

/**
 * Backward-compatible PersistenceService wrapper
 * Delegates all operations to the PersistenceOrchestrator
 */
export class PersistenceService {
  private service: PersistenceOrchestratorInterface;

  constructor() {
    this.service = persistenceOrchestrator;
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    return this.service.init();
  }

  // ========== Queue Operations ==========

  async saveQueue(tasks: ScanTask[]): Promise<void> {
    return this.service.saveQueue(tasks);
  }

  async loadQueue(): Promise<ScanTask[]> {
    return this.service.loadQueue();
  }

  async clearQueue(): Promise<void> {
    return this.service.clearQueue();
  }

  // ========== History Operations ==========

  async addToHistory(task: ScanTask): Promise<void> {
    return this.service.addToHistory(task);
  }

  async getHistory(options: SearchOptions = {}): Promise<{
    entries: HistoryEntry[];
    total: number;
    hasMore: boolean;
  }> {
    return this.service.getHistory(options);
  }

  async findExistingScan(
    sha256: string,
    size: number
  ): Promise<HistoryEntry | null> {
    return this.service.findExistingScan(sha256, size);
  }

  async clearHistory(): Promise<void> {
    return this.service.clearHistory();
  }

  async getHistoryFile(fileId: string): Promise<Blob | null> {
    return this.service.getHistoryFile(fileId);
  }

  // ========== Settings Operations ==========

  async getSettings(): Promise<Settings> {
    return this.service.getSettings();
  }

  async updateSettings(updates: Partial<Settings>): Promise<void> {
    return this.service.updateSettings(updates);
  }

  // ========== Utility Operations ==========

  async exportData(): Promise<{
    queue: ScanTask[];
    history: HistoryEntry[];
    settings: Settings;
    exportDate: Date;
  }> {
    return this.service.exportData();
  }

  async getStorageStats(): Promise<{
    queueCount: number;
    historyCount: number;
    filesCount: number;
    estimatedSize?: number;
    actualFileSize?: number;
  }> {
    return this.service.getStorageStats();
  }

  async cleanupInvalidHistoryEntries(): Promise<number> {
    return this.service.cleanupInvalidHistoryEntries();
  }
}

// Singleton instance
export const persistenceService = new PersistenceService();
