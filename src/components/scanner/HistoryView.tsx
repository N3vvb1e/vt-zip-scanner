/**
 * Refactored HistoryView component
 * Now uses focused hooks and components for better maintainability
 * Reduced from 1,075 lines to ~150 lines
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { History } from "lucide-react";
import type {
  HistoryEntry,
  SearchOptions,
} from "../../services/repositories/historyRepository";

// Import our new focused hooks
import { useHistoryFilters } from "../../hooks/useHistoryFilters";
import { useHistorySelection } from "../../hooks/useHistorySelection";
import { useHistoryActions } from "../../hooks/useHistoryActions";
import { useHistoryProcessing } from "../../hooks/useHistoryProcessing";

// Import our new focused components
import { HistoryStats } from "./history/HistoryStats";
import { HistoryFilters } from "./history/HistoryFilters";
import { HistoryActions } from "./history/HistoryActions";
import { HistoryTable } from "./history/HistoryTable";
import { HistoryPagination } from "./history/HistoryPagination";
import { HistoryConfirmDialogs } from "./history/HistoryConfirmDialogs";

interface HistoryViewProps {
  entries: HistoryEntry[];
  total: number;
  loading: boolean;
  onLoadHistory: (options: SearchOptions) => Promise<void>;
  onDeleteHistoryEntry: (entryId: string) => Promise<void>;
  onDeleteHistoryEntries: (entryIds: string[]) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onDownloadFile: (fileId: string, fileName: string) => Promise<void>;
  onDownloadSelectedFiles: (entryIds: string[]) => Promise<void>;
  storageStats?: {
    historyCount: number;
    filesCount: number;
    estimatedSize?: number;
    actualFileSize?: number;
  };
}

export function HistoryView({
  entries,
  total,
  loading,
  onLoadHistory,
  onDeleteHistoryEntry,
  onDeleteHistoryEntries,
  onClearHistory,
  onDownloadFile,
  onDownloadSelectedFiles,
  storageStats,
}: HistoryViewProps) {
  // State for view mode and pagination
  const [showFilters, setShowFilters] = useState(false);
  const [showUniqueOnly, setShowUniqueOnly] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  // Initialize our focused hooks
  const filters = useHistoryFilters();
  const selection = useHistorySelection();
  const actions = useHistoryActions();
  const processing = useHistoryProcessing(
    entries,
    showUniqueOnly,
    filters.filters.status
  );

  // Load history on mount and when filters change
  useEffect(() => {
    const searchOptions = filters.buildSearchOptions(currentPage, pageSize);
    onLoadHistory(searchOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters.buildSearchOptions, onLoadHistory, pageSize]);

  // Reset page when filters change or view mode changes
  useEffect(() => {
    setCurrentPage(0);
  }, [
    filters.filters.query,
    filters.filters.status,
    filters.filters.dateRange,
    filters.filters.hasThreats,
    showUniqueOnly,
  ]);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle download file
  const handleDownloadFile = useCallback(
    async (fileId: string, fileName: string) => {
      await onDownloadFile(fileId, fileName);
    },
    [onDownloadFile]
  );

  // Handle delete single entry
  const handleDeleteSingle = useCallback(
    (entryId: string) => {
      actions.handleDeleteSingle(
        entryId,
        showUniqueOnly,
        processing.processedEntries
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions.handleDeleteSingle, showUniqueOnly, processing.processedEntries]
  );

  // Handle delete selected entries
  const handleDeleteSelected = useCallback(() => {
    actions.handleDeleteSelected(
      selection.selectedEntries,
      showUniqueOnly,
      processing.processedEntries
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actions.handleDeleteSelected,
    selection.selectedEntries,
    showUniqueOnly,
    processing.processedEntries,
  ]);

  // Handle download selected files
  const handleDownloadSelected = useCallback(async () => {
    await actions.handleDownloadSelected(
      selection.selectedEntries,
      showUniqueOnly,
      processing.processedEntries,
      onDownloadSelectedFiles
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actions.handleDownloadSelected,
    selection.selectedEntries,
    showUniqueOnly,
    processing.processedEntries,
    onDownloadSelectedFiles,
  ]);

  // Get computed values for actions (memoized to prevent flickering)
  const safeFileCount = useMemo(
    () =>
      actions.getSafeFileCount(
        selection.selectedEntries,
        showUniqueOnly,
        processing.processedEntries
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      actions.getSafeFileCount,
      selection.selectedEntries,
      showUniqueOnly,
      processing.processedEntries,
    ]
  );

  const hasMaliciousFiles = useMemo(
    () =>
      actions.hasMaliciousFilesInSelection(
        selection.selectedEntries,
        showUniqueOnly,
        processing.processedEntries
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      actions.hasMaliciousFilesInSelection,
      selection.selectedEntries,
      showUniqueOnly,
      processing.processedEntries,
    ]
  );

  // Get filtered entries for display (memoized)
  const displayedEntries = useMemo(
    () => filters.getFilteredEntries(processing.processedEntries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.getFilteredEntries, processing.processedEntries]
  );

  // Stable selectAll callback
  const handleSelectAll = useCallback(() => {
    selection.selectAll(displayedEntries);
  }, [selection, displayedEntries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Scan History
          </h2>
        </div>
      </div>

      {/* Statistics */}
      <HistoryStats
        total={total}
        displayedCount={displayedEntries.length}
        showUniqueOnly={showUniqueOnly}
        storageStats={storageStats}
      />

      {/* Filters */}
      <HistoryFilters
        filters={filters.filters}
        updateFilter={filters.updateFilter}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        totalEntries={total}
        filteredCount={displayedEntries.length}
      />

      {/* Actions */}
      <HistoryActions
        selectionMode={selection.selectionMode}
        selectedCount={selection.selectedCount}
        hasSelection={selection.hasSelection}
        totalEntries={displayedEntries.length}
        toggleSelectionMode={selection.toggleSelectionMode}
        selectAll={handleSelectAll}
        handleDeleteSelected={handleDeleteSelected}
        handleDownloadSelected={handleDownloadSelected}
        handleClearAll={actions.handleClearAll}
        safeFileCount={safeFileCount}
        hasMaliciousFiles={hasMaliciousFiles}
        showUniqueOnly={showUniqueOnly}
        setShowUniqueOnly={setShowUniqueOnly}
      />

      {/* Table */}
      <HistoryTable
        entries={displayedEntries}
        showUniqueOnly={showUniqueOnly}
        selectionMode={selection.selectionMode}
        selectedEntries={selection.selectedEntries}
        onToggleSelection={selection.toggleSelection}
        onDownloadFile={handleDownloadFile}
        onDeleteSingle={handleDeleteSingle}
        loading={loading}
      />

      {/* Pagination */}
      {!showUniqueOnly && total > pageSize && (
        <HistoryPagination
          currentPage={currentPage}
          totalEntries={total}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      )}

      {/* Confirmation Dialogs */}
      <HistoryConfirmDialogs
        showDeleteConfirm={actions.showDeleteConfirm}
        deleteTarget={actions.deleteTarget}
        onConfirmDelete={() =>
          actions.confirmDelete(
            onDeleteHistoryEntry,
            onDeleteHistoryEntries,
            selection.clearSelection
          )
        }
        onCancelDelete={actions.cancelDelete}
        showClearAllConfirm={actions.showClearAllConfirm}
        onConfirmClearAll={() => actions.confirmClearAll(onClearHistory)}
        onCancelClearAll={actions.cancelClearAll}
      />
    </div>
  );
}
