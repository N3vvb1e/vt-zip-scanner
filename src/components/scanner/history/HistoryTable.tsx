/**
 * History table component
 * Displays the main data table for history entries
 */

import { useState } from "react";
import { Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  ExternalLink,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import type { HistoryEntry } from "../../../services/repositories/historyRepository";
import type { UniqueFileEntry } from "../../../hooks/useHistorySelection";
import { formatFileSize } from "../../../utils/common";

interface HistoryTableProps {
  entries: (HistoryEntry | UniqueFileEntry)[];
  showUniqueOnly: boolean;
  selectionMode: boolean;
  selectedEntries: Set<string>;
  onToggleSelection: (entryId: string) => void;
  onDownloadFile: (fileId: string, fileName: string) => Promise<void>;
  onDeleteSingle: (entryId: string) => void;
  loading?: boolean;
}

export function HistoryTable({
  entries,
  showUniqueOnly,
  selectionMode,
  selectedEntries,
  onToggleSelection,
  onDownloadFile,
  onDeleteSingle,
  loading = false,
}: HistoryTableProps) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set()
  );

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDownload = async (entry: HistoryEntry) => {
    try {
      await onDownloadFile(entry.fileId, entry.fileName);
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  };

  const getStatusBadge = (entry: HistoryEntry) => {
    if (entry.status === "error") {
      return <Badge variant="destructive">Error</Badge>;
    }

    if (entry.report?.stats?.malicious && entry.report.stats.malicious > 0) {
      const threatText = `${entry.report.stats.malicious} Threat${
        entry.report.stats.malicious > 1 ? "s" : ""
      }`;
      return (
        <Badge variant="destructive">
          {entry.status === "reused" ? `${threatText} (Cached)` : threatText}
        </Badge>
      );
    }

    return (
      <Badge variant="success">
        {entry.status === "reused" ? "Safe (Cached)" : "Safe"}
      </Badge>
    );
  };

  const openVirusTotalLink = (sha256: string) => {
    const url = `https://www.virustotal.com/gui/file/${sha256}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const isFileMalicious = (entry: HistoryEntry): boolean => {
    return (
      entry.status === "error" ||
      !!(entry.report?.stats?.malicious && entry.report.stats.malicious > 0)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading history...
        </span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 dark:text-gray-600 mb-2">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          No scan history
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Files you scan will appear here for easy access and download.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {selectionMode && (
                <th className="w-12 px-4 py-3 text-left">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                File
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Scan Time
              </th>
              {showUniqueOnly && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duplicates
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {entries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);
              const isUniqueEntry = "duplicateCount" in entry;
              const uniqueEntry = entry as UniqueFileEntry;

              return (
                <Fragment key={entry.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {/* Selection Checkbox */}
                    {selectionMode && (
                      <td className="px-4 py-4">
                        <button
                          onClick={() => onToggleSelection(entry.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {selectedEntries.has(entry.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                    )}

                    {/* File Name */}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        {isUniqueEntry && uniqueEntry.duplicateCount > 1 && (
                          <button
                            onClick={() => toggleExpanded(entry.id)}
                            className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {entry.fileName}
                          </p>
                          {entry.report?.meta?.file_info?.sha256 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                              {entry.report.meta.file_info.sha256}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">{getStatusBadge(entry)}</td>

                    {/* Size */}
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {formatFileSize(entry.fileSize)}
                    </td>

                    {/* Date & Time */}
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {new Date(
                        entry.completedAt || entry.createdAt
                      ).toLocaleString()}
                    </td>

                    {/* Duplicates (Unique Mode Only) */}
                    {showUniqueOnly && (
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {isUniqueEntry ? (
                          uniqueEntry.duplicateCount > 1 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                              {uniqueEntry.duplicateCount - 1}
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">
                              0
                            </span>
                          )
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">
                            0
                          </span>
                        )}
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Download Button - Only show for safe files */}
                        {!isFileMalicious(entry) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(entry)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}

                        {/* VirusTotal Link */}
                        {entry.report?.meta?.file_info?.sha256 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openVirusTotalLink(
                                entry.report!.meta!.file_info!.sha256
                              )
                            }
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="View on VirusTotal"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteSingle(entry.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Duplicates Row */}
                  {isExpanded &&
                    isUniqueEntry &&
                    uniqueEntry.allEntries.length > 1 && (
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <td
                          colSpan={showUniqueOnly ? 7 : 6}
                          className="px-4 py-3"
                        >
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              All Scans ({uniqueEntry.allEntries.length})
                            </h4>
                            <div className="space-y-2">
                              {uniqueEntry.allEntries.map(
                                (duplicateEntry, index) => (
                                  <div
                                    key={duplicateEntry.id}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                                  >
                                    <div className="flex items-center gap-3">
                                      {selectionMode && (
                                        <button
                                          onClick={() =>
                                            onToggleSelection(duplicateEntry.id)
                                          }
                                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                        >
                                          {selectedEntries.has(
                                            duplicateEntry.id
                                          ) ? (
                                            <CheckSquare className="h-4 w-4 text-blue-600" />
                                          ) : (
                                            <Square className="h-4 w-4" />
                                          )}
                                        </button>
                                      )}

                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            Scan #
                                            {uniqueEntry.allEntries.length -
                                              index}
                                          </span>
                                          {getStatusBadge(duplicateEntry)}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          {new Date(
                                            duplicateEntry.completedAt ||
                                              duplicateEntry.createdAt
                                          ).toLocaleString()}
                                          {duplicateEntry.zipFileName && (
                                            <span className="ml-2">
                                              from {duplicateEntry.zipFileName}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Download Button - Only show for safe files */}
                                      {!isFileMalicious(duplicateEntry) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleDownload(duplicateEntry)
                                          }
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          title="Download this scan"
                                        >
                                          <Download className="h-3 w-3" />
                                        </Button>
                                      )}

                                      {/* VirusTotal Link */}
                                      {duplicateEntry.report?.meta?.file_info
                                        ?.sha256 && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            openVirusTotalLink(
                                              duplicateEntry.report!.meta!
                                                .file_info!.sha256
                                            )
                                          }
                                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                          title="View on VirusTotal"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </Button>
                                      )}

                                      {/* Delete Button */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          onDeleteSingle(duplicateEntry.id)
                                        }
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="Delete this scan"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
