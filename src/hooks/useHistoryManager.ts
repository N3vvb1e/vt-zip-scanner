/**
 * History management hook
 * Handles scan history operations
 */

import { useState, useCallback } from "react";
import type { ScanTask } from "../types/index";
import {
  persistenceService,
  type HistoryEntry,
  type SearchOptions,
  type Settings,
} from "../services/persistenceService";

export interface HistoryManagerHook {
  historyEntries: HistoryEntry[];
  historyTotal: number;
  historyLoading: boolean;
  loadHistory: (options?: SearchOptions) => Promise<void>;
  deleteHistoryEntry: (entryId: string) => Promise<void>;
  deleteHistoryEntries: (entryIds: string[]) => Promise<void>;
  clearHistory: () => Promise<void>;
  getHistoryFile: (fileId: string) => Promise<Blob | null>;
  addToHistory: (task: ScanTask) => Promise<void>;
  getStorageStats: () => Promise<{
    queueCount: number;
    historyCount: number;
    filesCount: number;
    estimatedSize?: number;
    actualFileSize?: number;
  }>;
  exportData: () => Promise<{
    queue: ScanTask[];
    history: HistoryEntry[];
    settings: Settings;
    exportDate: Date;
  }>;
}

export function useHistoryManager(): HistoryManagerHook {
  // History state
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Add completed task to history
  const addToHistory = useCallback(async (task: ScanTask) => {
    try {
      await persistenceService.addToHistory(task);
      // Note: History will be refreshed when user navigates to history view
    } catch (error) {
      console.error("Failed to add task to history:", error);
    }
  }, []);

  // History management functions
  const loadHistory = useCallback(async (options: SearchOptions = {}) => {
    setHistoryLoading(true);
    try {
      const result = await persistenceService.getHistory(options);
      setHistoryEntries(result.entries);
      setHistoryTotal(result.total);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const deleteHistoryEntry = useCallback(async (entryId: string) => {
    try {
      await persistenceService.deleteHistoryEntry(entryId);
      // Remove the entry from local state
      setHistoryEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      setHistoryTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to delete history entry:", error);
    }
  }, []);

  const deleteHistoryEntries = useCallback(async (entryIds: string[]) => {
    try {
      await persistenceService.deleteHistoryEntries(entryIds);
      // Remove the entries from local state
      const entryIdSet = new Set(entryIds);
      setHistoryEntries((prev) =>
        prev.filter((entry) => !entryIdSet.has(entry.id))
      );
      setHistoryTotal((prev) => Math.max(0, prev - entryIds.length));
    } catch (error) {
      console.error("Failed to delete history entries:", error);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await persistenceService.clearHistory();
      setHistoryEntries([]);
      setHistoryTotal(0);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  }, []);

  const getHistoryFile = useCallback(
    async (fileId: string): Promise<Blob | null> => {
      try {
        return await persistenceService.getHistoryFile(fileId);
      } catch (error) {
        console.error("Failed to get file from history:", error);
        return null;
      }
    },
    []
  );

  // Storage stats
  const getStorageStats = useCallback(() => {
    return persistenceService.getStorageStats();
  }, []);

  const exportData = useCallback(() => {
    return persistenceService.exportData();
  }, []);

  return {
    historyEntries,
    historyTotal,
    historyLoading,
    loadHistory,
    deleteHistoryEntry,
    deleteHistoryEntries,
    clearHistory,
    getHistoryFile,
    addToHistory,
    getStorageStats,
    exportData,
  };
}
