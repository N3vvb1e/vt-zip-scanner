/**
 * History actions component
 * Handles bulk actions toolbar for history view
 */

import { Download, Trash2, CheckSquare, AlertTriangle, X } from "lucide-react";
import { Button } from "../../ui/Button";

interface HistoryActionsProps {
  // Selection state
  selectionMode: boolean;
  selectedCount: number;
  hasSelection: boolean;
  totalEntries: number;

  // Actions
  toggleSelectionMode: () => void;
  selectAll: () => void;
  handleDeleteSelected: () => void;
  handleDownloadSelected: () => void;
  handleClearAll: () => void;

  // Computed values
  safeFileCount: number;
  hasMaliciousFiles: boolean;

  // View mode
  showUniqueOnly: boolean;
  setShowUniqueOnly: (show: boolean) => void;
}

export function HistoryActions({
  selectionMode,
  selectedCount,
  hasSelection,
  totalEntries,
  toggleSelectionMode,
  selectAll,
  handleDeleteSelected,
  handleDownloadSelected,
  handleClearAll,
  safeFileCount,
  hasMaliciousFiles,
  showUniqueOnly,
  setShowUniqueOnly,
}: HistoryActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          View:
        </span>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setShowUniqueOnly(true)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              showUniqueOnly
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            Unique Files
          </button>
          <button
            onClick={() => setShowUniqueOnly(false)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              !showUniqueOnly
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            All Scans
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {!selectionMode ? (
          <>
            {/* Normal Mode Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectionMode}
              className="flex items-center gap-2"
            >
              <CheckSquare className="h-4 w-4" />
              Select
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          </>
        ) : (
          <>
            {/* Selection Mode Actions */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{selectedCount} selected</span>
              {selectedCount < totalEntries && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-blue-600 hover:text-blue-700 p-1 h-auto"
                >
                  Select All
                </Button>
              )}
            </div>

            {hasSelection && (
              <>
                {/* Download Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSelected}
                  disabled={safeFileCount === 0}
                  className="flex items-center gap-2"
                  title={
                    safeFileCount === 0
                      ? "No safe files selected"
                      : `Download ${safeFileCount} safe file${
                          safeFileCount > 1 ? "s" : ""
                        }`
                  }
                >
                  <Download className="h-4 w-4" />
                  Download ({safeFileCount})
                </Button>

                {/* Delete Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedCount})
                </Button>

                {/* Malicious Files Warning */}
                {hasMaliciousFiles && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs">Contains threats</span>
                  </div>
                )}
              </>
            )}

            {/* Exit Selection Mode */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectionMode}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
