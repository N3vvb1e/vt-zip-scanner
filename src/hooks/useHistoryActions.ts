/**
 * History actions hook
 * Manages bulk actions and operations for history view
 */

import { useState, useCallback } from "react";
import type { HistoryEntry } from "../services/repositories/historyRepository";
import type { UniqueFileEntry } from "./useHistorySelection";
import { logger } from "../utils/logger";

export interface DeleteTarget {
  type: "single" | "multiple";
  entryId?: string;
  entryIds?: string[];
}

export interface HistoryActionsHook {
  // Delete confirmation state
  showDeleteConfirm: boolean;
  deleteTarget: DeleteTarget | null;
  showClearAllConfirm: boolean;
  
  // Delete actions
  handleDeleteSingle: (entryId: string, showUniqueOnly: boolean, processedEntries: (HistoryEntry | UniqueFileEntry)[]) => void;
  handleDeleteSelected: (selectedEntries: Set<string>, showUniqueOnly: boolean, processedEntries: (HistoryEntry | UniqueFileEntry)[]) => void;
  confirmDelete: (
    onDeleteHistoryEntry: (entryId: string) => Promise<void>,
    onDeleteHistoryEntries: (entryIds: string[]) => Promise<void>,
    clearSelection: () => void
  ) => Promise<void>;
  cancelDelete: () => void;
  
  // Clear all actions
  handleClearAll: () => void;
  confirmClearAll: (onClearHistory: () => Promise<void>) => Promise<void>;
  cancelClearAll: () => void;
  
  // Download actions
  handleDownloadSelected: (
    selectedEntries: Set<string>,
    showUniqueOnly: boolean,
    processedEntries: (HistoryEntry | UniqueFileEntry)[],
    onDownloadSelectedFiles: (entryIds: string[]) => Promise<void>
  ) => Promise<void>;
  
  // Utility functions
  getSafeFileCount: (selectedEntries: Set<string>, showUniqueOnly: boolean, processedEntries: (HistoryEntry | UniqueFileEntry)[]) => number;
  hasMaliciousFilesInSelection: (selectedEntries: Set<string>, showUniqueOnly: boolean, processedEntries: (HistoryEntry | UniqueFileEntry)[]) => boolean;
}

export function useHistoryActions(): HistoryActionsHook {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Helper function to check if entry is safe
  const isEntrySafe = useCallback((entry: HistoryEntry) => {
    return (
      (entry.status === "completed" || entry.status === "reused") &&
      (!entry.report?.stats.malicious || entry.report.stats.malicious === 0)
    );
  }, []);

  // Helper function to check if entry is malicious
  const isEntryMalicious = useCallback((entry: HistoryEntry) => {
    return (
      entry.status === "error" ||
      (entry.report?.stats.malicious && entry.report.stats.malicious > 0)
    );
  }, []);

  // Delete single entry
  const handleDeleteSingle = useCallback((
    entryId: string,
    showUniqueOnly: boolean,
    processedEntries: (HistoryEntry | UniqueFileEntry)[]
  ) => {
    if (showUniqueOnly) {
      // In unique files mode, find the unique entry and delete all its duplicates
      const uniqueEntry = processedEntries.find(
        (entry) => entry.id === entryId
      ) as UniqueFileEntry;
      if (uniqueEntry && uniqueEntry.allEntries) {
        const allEntryIds = uniqueEntry.allEntries.map((entry) => entry.id);
        // If there's only one entry (no duplicates), treat it as a single delete
        if (allEntryIds.length === 1) {
          setDeleteTarget({ type: "single", entryId });
        } else {
          setDeleteTarget({ type: "multiple", entryIds: allEntryIds });
        }
      } else {
        setDeleteTarget({ type: "single", entryId });
      }
    } else {
      setDeleteTarget({ type: "single", entryId });
    }
    setShowDeleteConfirm(true);
  }, []);

  // Delete selected entries
  const handleDeleteSelected = useCallback((
    selectedEntries: Set<string>,
    showUniqueOnly: boolean,
    processedEntries: (HistoryEntry | UniqueFileEntry)[]
  ) => {
    if (showUniqueOnly) {
      // In unique files mode, collect all duplicate entries for selected unique files
      const allEntryIds: string[] = [];
      selectedEntries.forEach((selectedId) => {
        const uniqueEntry = processedEntries.find(
          (entry) => entry.id === selectedId
        ) as UniqueFileEntry;
        if (uniqueEntry && uniqueEntry.allEntries) {
          allEntryIds.push(...uniqueEntry.allEntries.map((entry) => entry.id));
        } else {
          allEntryIds.push(selectedId);
        }
      });
      setDeleteTarget({ type: "multiple", entryIds: allEntryIds });
    } else {
      const entryIds = Array.from(selectedEntries);
      setDeleteTarget({ type: "multiple", entryIds });
    }
    setShowDeleteConfirm(true);
  }, []);

  // Confirm delete action
  const confirmDelete = useCallback(async (
    onDeleteHistoryEntry: (entryId: string) => Promise<void>,
    onDeleteHistoryEntries: (entryIds: string[]) => Promise<void>,
    clearSelection: () => void
  ) => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "single" && deleteTarget.entryId) {
        await onDeleteHistoryEntry(deleteTarget.entryId);
        logger.success("History entry deleted");
      } else if (deleteTarget.type === "multiple" && deleteTarget.entryIds) {
        await onDeleteHistoryEntries(deleteTarget.entryIds);
        logger.success("History entries deleted", { count: deleteTarget.entryIds.length });
        clearSelection();
      }
    } catch (error) {
      logger.error("Failed to delete entries", error);
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // Cancel delete action
  const cancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setShowClearAllConfirm(true);
  }, []);

  // Confirm clear all
  const confirmClearAll = useCallback(async (onClearHistory: () => Promise<void>) => {
    try {
      await onClearHistory();
      logger.success("History cleared");
    } catch (error) {
      logger.error("Failed to clear history", error);
    } finally {
      setShowClearAllConfirm(false);
    }
  }, []);

  // Cancel clear all
  const cancelClearAll = useCallback(() => {
    setShowClearAllConfirm(false);
  }, []);

  // Handle download selected files
  const handleDownloadSelected = useCallback(async (
    selectedEntries: Set<string>,
    showUniqueOnly: boolean,
    processedEntries: (HistoryEntry | UniqueFileEntry)[],
    onDownloadSelectedFiles: (entryIds: string[]) => Promise<void>
  ) => {
    if (selectedEntries.size === 0) return;

    try {
      if (showUniqueOnly) {
        // In unique files mode, download only one instance per unique file
        const entryIds: string[] = [];
        selectedEntries.forEach((selectedId) => {
          const uniqueEntry = processedEntries.find(
            (entry) => entry.id === selectedId
          ) as UniqueFileEntry;
          if (uniqueEntry && uniqueEntry.allEntries) {
            // Find the first safe entry from all duplicates
            const safeEntry = uniqueEntry.allEntries.find((entry) => isEntrySafe(entry));
            if (safeEntry) {
              entryIds.push(safeEntry.id);
            }
          } else {
            // Check if the single entry is safe
            if (isEntrySafe(uniqueEntry)) {
              entryIds.push(selectedId);
            }
          }
        });
        await onDownloadSelectedFiles(entryIds);
      } else {
        // In all scans mode, filter for safe files only
        const safeEntryIds = Array.from(selectedEntries).filter((entryId) => {
          const entry = processedEntries.find((e) => e.id === entryId);
          return entry && isEntrySafe(entry);
        });
        await onDownloadSelectedFiles(safeEntryIds);
      }
      logger.success("Files downloaded");
    } catch (error) {
      logger.error("Failed to download selected files", error);
    }
  }, [isEntrySafe]);

  // Get count of safe files in selection
  const getSafeFileCount = useCallback((
    selectedEntries: Set<string>,
    showUniqueOnly: boolean,
    processedEntries: (HistoryEntry | UniqueFileEntry)[]
  ): number => {
    if (showUniqueOnly) {
      let safeCount = 0;
      selectedEntries.forEach((selectedId) => {
        const uniqueEntry = processedEntries.find(
          (entry) => entry.id === selectedId
        ) as UniqueFileEntry;
        if (uniqueEntry && uniqueEntry.allEntries) {
          // Check if there's at least one safe entry among duplicates
          const hasSafeEntry = uniqueEntry.allEntries.some((entry) => isEntrySafe(entry));
          if (hasSafeEntry) {
            safeCount += 1; // Count only one file per unique selection
          }
        } else {
          if (isEntrySafe(uniqueEntry)) {
            safeCount += 1;
          }
        }
      });
      return safeCount;
    } else {
      return Array.from(selectedEntries).filter((entryId) => {
        const entry = processedEntries.find((e) => e.id === entryId);
        return entry && isEntrySafe(entry);
      }).length;
    }
  }, [isEntrySafe]);

  // Check if selection contains any malicious files
  const hasMaliciousFilesInSelection = useCallback((
    selectedEntries: Set<string>,
    showUniqueOnly: boolean,
    processedEntries: (HistoryEntry | UniqueFileEntry)[]
  ): boolean => {
    if (showUniqueOnly) {
      return Array.from(selectedEntries).some((selectedId) => {
        const uniqueEntry = processedEntries.find(
          (entry) => entry.id === selectedId
        ) as UniqueFileEntry;
        if (uniqueEntry && uniqueEntry.allEntries) {
          // Check if any entry among duplicates is malicious
          return uniqueEntry.allEntries.some((entry) => isEntryMalicious(entry));
        } else {
          return isEntryMalicious(uniqueEntry);
        }
      });
    } else {
      return Array.from(selectedEntries).some((entryId) => {
        const entry = processedEntries.find((e) => e.id === entryId);
        return entry && isEntryMalicious(entry);
      });
    }
  }, [isEntryMalicious]);

  return {
    showDeleteConfirm,
    deleteTarget,
    showClearAllConfirm,
    handleDeleteSingle,
    handleDeleteSelected,
    confirmDelete,
    cancelDelete,
    handleClearAll,
    confirmClearAll,
    cancelClearAll,
    handleDownloadSelected,
    getSafeFileCount,
    hasMaliciousFilesInSelection,
  };
}
