/**
 * History stats component
 * Displays statistics and storage information for history view
 */

import { FileText, Database, Clock } from "lucide-react";

interface HistoryStatsProps {
  total: number;
  displayedCount: number;
  showUniqueOnly: boolean;
  storageStats?: {
    historyCount: number;
    filesCount: number;
    estimatedSize?: number;
    actualFileSize?: number;
  };
}

export function HistoryStats({
  total,
  displayedCount,
  showUniqueOnly,
  storageStats,
}: HistoryStatsProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Total Entries */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {showUniqueOnly ? "Unique Files" : "Total Scans"}
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {displayedCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Database Entries */}
        {storageStats && (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Database Entries
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {storageStats.historyCount.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Storage Size */}
        {storageStats && storageStats.actualFileSize !== undefined && (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Storage Used
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatBytes(storageStats.actualFileSize)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Additional Info */}
      {showUniqueOnly && total !== displayedCount && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {displayedCount.toLocaleString()} unique files from{" "}
            {total.toLocaleString()} total scans
          </p>
        </div>
      )}
    </div>
  );
}
