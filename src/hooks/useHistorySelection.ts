/**
 * History selection hook
 * Manages selection state and logic for history view
 */

import { useState, useCallback } from "react";
import type { HistoryEntry } from "../services/repositories/historyRepository";

export interface UniqueFileEntry extends HistoryEntry {
  duplicateCount: number;
  allEntries: HistoryEntry[];
}

export interface HistorySelectionHook {
  selectedEntries: Set<string>;
  selectionMode: boolean;
  toggleSelection: (entryId: string) => void;
  selectAll: (entries: HistoryEntry[] | UniqueFileEntry[]) => void;
  clearSelection: () => void;
  toggleSelectionMode: () => void;
  isSelected: (entryId: string) => boolean;
  selectedCount: number;
  hasSelection: boolean;
}

export function useHistorySelection(): HistorySelectionHook {
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Toggle selection for a single entry
  const toggleSelection = useCallback((entryId: string) => {
    setSelectedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  }, []);

  // Select all entries
  const selectAll = useCallback((entries: HistoryEntry[] | UniqueFileEntry[]) => {
    const allIds = entries.map((entry) => entry.id);
    setSelectedEntries(new Set(allIds));
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedEntries(new Set());
  }, []);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      clearSelection();
    }
  }, [selectionMode, clearSelection]);

  // Check if an entry is selected
  const isSelected = useCallback((entryId: string) => {
    return selectedEntries.has(entryId);
  }, [selectedEntries]);

  // Computed properties
  const selectedCount = selectedEntries.size;
  const hasSelection = selectedCount > 0;

  return {
    selectedEntries,
    selectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    toggleSelectionMode,
    isSelected,
    selectedCount,
    hasSelection,
  };
}
