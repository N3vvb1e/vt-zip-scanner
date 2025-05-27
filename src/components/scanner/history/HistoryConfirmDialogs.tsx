/**
 * History confirmation dialogs component
 * Handles delete and clear confirmation dialogs
 */

import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../../ui/Button";
import type { DeleteTarget } from "../../../hooks/useHistoryActions";

interface HistoryConfirmDialogsProps {
  // Delete confirmation
  showDeleteConfirm: boolean;
  deleteTarget: DeleteTarget | null;
  onConfirmDelete: () => Promise<void>;
  onCancelDelete: () => void;
  
  // Clear all confirmation
  showClearAllConfirm: boolean;
  onConfirmClearAll: () => Promise<void>;
  onCancelClearAll: () => void;
}

export function HistoryConfirmDialogs({
  showDeleteConfirm,
  deleteTarget,
  onConfirmDelete,
  onCancelDelete,
  showClearAllConfirm,
  onConfirmClearAll,
  onCancelClearAll,
}: HistoryConfirmDialogsProps) {
  if (!showDeleteConfirm && !showClearAllConfirm) {
    return null;
  }

  return (
    <>
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Confirm Deletion
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                {deleteTarget.type === "single" ? (
                  <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete this scan result? The file and its scan data will be permanently removed.
                  </p>
                ) : (
                  <p className="text-gray-700 dark:text-gray-300">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold">
                      {deleteTarget.entryIds?.length || 0} scan result{deleteTarget.entryIds?.length !== 1 ? "s" : ""}
                    </span>
                    ? The files and their scan data will be permanently removed.
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={onCancelDelete}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onConfirmDelete}
                  className="px-4 py-2 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Clear All History
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300">
                  Are you sure you want to clear all scan history? This will permanently delete all scan results and stored files.
                </p>
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> This will remove all your scan history and cannot be recovered.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={onCancelClearAll}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onConfirmClearAll}
                  className="px-4 py-2 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
