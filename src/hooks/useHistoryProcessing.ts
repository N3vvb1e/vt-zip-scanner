/**
 * History processing hook
 * Handles unique file processing and grouping logic
 */

import { useMemo } from "react";
import type { HistoryEntry } from "../services/repositories/historyRepository";
import type { UniqueFileEntry } from "./useHistorySelection";

export interface HistoryProcessingHook {
  processedEntries: (HistoryEntry | UniqueFileEntry)[];
}

export function useHistoryProcessing(
  entries: HistoryEntry[],
  showUniqueOnly: boolean,
  statusFilter: "all" | "completed" | "error"
): HistoryProcessingHook {
  
  // Process entries to show unique files only or all entries
  const processedEntries = useMemo(() => {
    // First apply client-side status filtering for "completed" filter
    let filteredEntries = entries;
    if (statusFilter === "completed") {
      filteredEntries = entries.filter(
        (entry) => entry.status === "completed" || entry.status === "reused"
      );
    }

    if (!showUniqueOnly) {
      return filteredEntries;
    }

    // Group entries by file hash (SHA256) and size
    const fileGroups = new Map<string, HistoryEntry[]>();

    filteredEntries.forEach((entry) => {
      // Create a unique key based on file hash and size
      const fileHash = entry.report?.meta?.file_info?.sha256;
      const fileSize = entry.fileSize;
      const key = fileHash
        ? `${fileHash}-${fileSize}`
        : `${entry.fileName}-${fileSize}`;

      if (!fileGroups.has(key)) {
        fileGroups.set(key, []);
      }
      fileGroups.get(key)!.push(entry);
    });

    // Create unique entries with duplicate count
    const uniqueEntries: UniqueFileEntry[] = [];

    fileGroups.forEach((groupEntries) => {
      // Sort by date (most recent first) and take the latest scan
      const sortedEntries = groupEntries.sort(
        (a, b) =>
          new Date(b.completedAt || b.createdAt).getTime() -
          new Date(a.completedAt || a.createdAt).getTime()
      );

      const latestEntry = sortedEntries[0];
      const uniqueEntry: UniqueFileEntry = {
        ...latestEntry,
        duplicateCount: groupEntries.length,
        allEntries: sortedEntries,
      };

      uniqueEntries.push(uniqueEntry);
    });

    // Sort unique entries by most recent completion date
    return uniqueEntries.sort(
      (a, b) =>
        new Date(b.completedAt || b.createdAt).getTime() -
        new Date(a.completedAt || a.createdAt).getTime()
    );
  }, [entries, showUniqueOnly, statusFilter]);

  return {
    processedEntries,
  };
}
