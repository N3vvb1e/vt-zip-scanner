import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Search,
  Calendar,
  Filter,
  Download,
  Trash2,
  Shield,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Database,
  HardDrive,
  Square,
  CheckSquare,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import type {
  HistoryEntry,
  SearchOptions,
} from "../../services/persistenceService";
import { formatFileSize } from "../../utils/common";

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

interface HistoryFilters {
  query: string;
  status: "all" | "completed" | "error";
  dateRange: "all" | "today" | "week" | "month";
  hasThreats: "all" | "safe" | "threats";
}

interface UniqueFileEntry extends HistoryEntry {
  duplicateCount: number;
  allEntries: HistoryEntry[];
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
  const [filters, setFilters] = useState<HistoryFilters>({
    query: "",
    status: "all",
    dateRange: "all",
    hasThreats: "all",
  });

  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set()
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showUniqueOnly, setShowUniqueOnly] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(
    new Set()
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "single" | "multiple";
    entryId?: string;
    entryIds?: string[];
  } | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const pageSize = 50;

  // Process entries to show unique files only or all entries
  const processedEntries = useMemo(() => {
    // First apply client-side status filtering for "completed" filter
    let filteredEntries = entries;
    if (filters.status === "completed") {
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
  }, [entries, showUniqueOnly, filters.status]);

  // Load history on mount
  useEffect(() => {
    loadFilteredHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search (and reset page)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(0); // Reset to first page when search query changes
      loadFilteredHistory(0); // Load with page 0 immediately
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query]);

  // Load when other filters change (and reset page)
  useEffect(() => {
    setCurrentPage(0); // Reset to first page when filters change
    loadFilteredHistory(0); // Load with page 0 immediately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.dateRange, filters.hasThreats]);

  // Load when page changes
  useEffect(() => {
    loadFilteredHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const loadFilteredHistory = useCallback(
    (page?: number) => {
      const pageToUse = page !== undefined ? page : currentPage;
      const searchOptions: SearchOptions = {
        limit: pageSize,
        offset: pageToUse * pageSize,
      };

      // Query
      if (filters.query) {
        searchOptions.query = filters.query;
      }

      // Status filter - only apply database filter for specific single statuses
      if (filters.status !== "all" && filters.status !== "completed") {
        // For "error" status, we can use the database index
        searchOptions.status = filters.status as "error";
      }
      // For "completed" status, we'll filter client-side to include both "completed" and "reused"

      // Date range
      if (filters.dateRange !== "all") {
        const now = new Date();
        switch (filters.dateRange) {
          case "today":
            searchOptions.dateFrom = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            searchOptions.dateFrom = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            searchOptions.dateFrom = new Date(now.setMonth(now.getMonth() - 1));
            break;
        }
      }

      // Threat filter
      if (filters.hasThreats !== "all") {
        searchOptions.hasThreats = filters.hasThreats === "threats";
      }

      onLoadHistory(searchOptions);
    },
    [filters, currentPage, onLoadHistory]
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

  // Selection handlers
  const toggleSelection = (entryId: string) => {
    setSelectedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = processedEntries.map((entry) => entry.id);
    setSelectedEntries(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedEntries(new Set());
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      clearSelection();
    }
  };

  // Delete handlers
  const handleDeleteSingle = (entryId: string) => {
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
  };

  const handleDeleteSelected = () => {
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
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "single" && deleteTarget.entryId) {
        await onDeleteHistoryEntry(deleteTarget.entryId);
      } else if (deleteTarget.type === "multiple" && deleteTarget.entryIds) {
        await onDeleteHistoryEntries(deleteTarget.entryIds);
        clearSelection();
      }
    } catch (error) {
      console.error("Failed to delete entries:", error);
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // Clear All handlers
  const handleClearAll = () => {
    setShowClearAllConfirm(true);
  };

  const confirmClearAll = async () => {
    try {
      await onClearHistory();
    } catch (error) {
      console.error("Failed to clear history:", error);
    } finally {
      setShowClearAllConfirm(false);
    }
  };

  const cancelClearAll = () => {
    setShowClearAllConfirm(false);
  };

  // Download handlers
  const handleDownloadSelected = async () => {
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
            const safeEntry = uniqueEntry.allEntries.find((entry) => {
              const isClean =
                (entry.status === "completed" || entry.status === "reused") &&
                (!entry.report?.stats.malicious ||
                  entry.report.stats.malicious === 0);
              return isClean;
            });
            if (safeEntry) {
              entryIds.push(safeEntry.id);
            }
          } else {
            // Check if the single entry is safe
            const isClean =
              (uniqueEntry.status === "completed" ||
                uniqueEntry.status === "reused") &&
              (!uniqueEntry.report?.stats.malicious ||
                uniqueEntry.report.stats.malicious === 0);
            if (isClean) {
              entryIds.push(selectedId);
            }
          }
        });
        await onDownloadSelectedFiles(entryIds);
      } else {
        // In all scans mode, filter for safe files only
        const safeEntryIds = Array.from(selectedEntries).filter((entryId) => {
          const entry = processedEntries.find((e) => e.id === entryId);
          if (!entry) return false;
          const isClean =
            (entry.status === "completed" || entry.status === "reused") &&
            (!entry.report?.stats.malicious ||
              entry.report.stats.malicious === 0);
          return isClean;
        });
        await onDownloadSelectedFiles(safeEntryIds);
      }
    } catch (error) {
      console.error("Failed to download selected files:", error);
    }
  };

  // Get count of safe files in selection
  const getSafeFileCount = () => {
    if (showUniqueOnly) {
      let safeCount = 0;
      selectedEntries.forEach((selectedId) => {
        const uniqueEntry = processedEntries.find(
          (entry) => entry.id === selectedId
        ) as UniqueFileEntry;
        if (uniqueEntry && uniqueEntry.allEntries) {
          // Check if there's at least one safe entry among duplicates
          const hasSafeEntry = uniqueEntry.allEntries.some((entry) => {
            const isClean =
              (entry.status === "completed" || entry.status === "reused") &&
              (!entry.report?.stats.malicious ||
                entry.report.stats.malicious === 0);
            return isClean;
          });
          if (hasSafeEntry) {
            safeCount += 1; // Count only one file per unique selection
          }
        } else {
          const isClean =
            (uniqueEntry.status === "completed" ||
              uniqueEntry.status === "reused") &&
            (!uniqueEntry.report?.stats.malicious ||
              uniqueEntry.report.stats.malicious === 0);
          if (isClean) {
            safeCount += 1;
          }
        }
      });
      return safeCount;
    } else {
      return Array.from(selectedEntries).filter((entryId) => {
        const entry = processedEntries.find((e) => e.id === entryId);
        if (!entry) return false;
        const isClean =
          (entry.status === "completed" || entry.status === "reused") &&
          (!entry.report?.stats.malicious ||
            entry.report.stats.malicious === 0);
        return isClean;
      }).length;
    }
  };

  // Check if selection contains any malicious files
  const hasMaliciousFilesInSelection = () => {
    if (showUniqueOnly) {
      return Array.from(selectedEntries).some((selectedId) => {
        const uniqueEntry = processedEntries.find(
          (entry) => entry.id === selectedId
        ) as UniqueFileEntry;
        if (uniqueEntry && uniqueEntry.allEntries) {
          // Check if any entry among duplicates is malicious
          return uniqueEntry.allEntries.some((entry) => {
            const isMalicious =
              entry.status === "error" ||
              (entry.report?.stats.malicious &&
                entry.report.stats.malicious > 0);
            return isMalicious;
          });
        } else {
          const isMalicious =
            uniqueEntry.status === "error" ||
            (uniqueEntry.report?.stats.malicious &&
              uniqueEntry.report.stats.malicious > 0);
          return isMalicious;
        }
      });
    } else {
      return Array.from(selectedEntries).some((entryId) => {
        const entry = processedEntries.find((e) => e.id === entryId);
        if (!entry) return false;
        const isMalicious =
          entry.status === "error" ||
          (entry.report?.stats.malicious && entry.report.stats.malicious > 0);
        return isMalicious;
      });
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
        {entry.status === "reused" ? "Clean (Cached)" : "Clean"}
      </Badge>
    );
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return d.toLocaleDateString();
    }
  };

  // Generate confirmation message for delete operations
  const getDeleteConfirmationMessage = () => {
    if (!deleteTarget) return "";

    if (deleteTarget.type === "single") {
      return "Are you sure you want to delete this history entry? This action cannot be undone.";
    }

    if (showUniqueOnly) {
      if (deleteTarget.entryIds && deleteTarget.entryIds.length === 1) {
        return "Are you sure you want to delete this history entry? This action cannot be undone.";
      }
      const uniqueCount = selectedEntries.size || 1;
      const totalCount = deleteTarget.entryIds?.length || 0;
      return `Are you sure you want to delete ${uniqueCount} unique ${
        uniqueCount === 1 ? "file" : "files"
      } and all their cached duplicates (${totalCount} total entries)? This action cannot be undone.`;
    }

    const entryCount = deleteTarget.entryIds?.length || 0;
    return `Are you sure you want to delete ${entryCount} history entries? This action cannot be undone.`;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <History className="h-6 w-6 text-primary mr-2" />
          <h2 className="text-2xl font-bold">Scan History</h2>
          <Badge variant="secondary" className="ml-3">
            {showUniqueOnly
              ? `${processedEntries.length} unique ${
                  processedEntries.length === 1 ? "file" : "files"
                }`
              : `${total} ${total === 1 ? "scan" : "scans"}`}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {storageStats && (
            <div className="flex items-center text-sm text-muted-foreground mr-4">
              <Database className="h-4 w-4 mr-1" />
              {storageStats.historyCount} entries
              {(storageStats.actualFileSize !== undefined ||
                storageStats.estimatedSize) && (
                <>
                  <span className="mx-2">•</span>
                  <HardDrive className="h-4 w-4 mr-1" />
                  {formatFileSize(
                    storageStats.actualFileSize ||
                      storageStats.estimatedSize ||
                      0
                  )}
                </>
              )}
            </div>
          )}

          <Button
            variant={showUniqueOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowUniqueOnly(!showUniqueOnly);
              setCurrentPage(0); // Reset to first page when switching modes
              clearSelection(); // Clear selection when switching modes since entry IDs change
              setSelectionMode(false); // Exit selection mode when switching
            }}
          >
            {showUniqueOnly ? "Unique Files" : "All Scans"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {showFilters ? (
              <ChevronUp className="h-4 w-4 ml-1" />
            ) : (
              <ChevronDown className="h-4 w-4 ml-1" />
            )}
          </Button>

          <Button
            variant={selectionMode ? "default" : "ghost"}
            size="sm"
            onClick={toggleSelectionMode}
            disabled={processedEntries.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            {selectionMode ? "Cancel" : "Select"}
          </Button>

          {selectionMode && selectedEntries.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSelected}
                disabled={
                  getSafeFileCount() === 0 || hasMaliciousFilesInSelection()
                }
                title={
                  getSafeFileCount() === 0
                    ? "No safe files selected for download"
                    : hasMaliciousFilesInSelection()
                    ? "Cannot download when malicious files are selected"
                    : showUniqueOnly
                    ? `Download ${getSafeFileCount()} unique safe ${
                        getSafeFileCount() === 1 ? "file" : "files"
                      }`
                    : `Download ${getSafeFileCount()} safe files`
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Download ({getSafeFileCount()})
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                title={
                  showUniqueOnly
                    ? `Delete ${selectedEntries.size} unique files and all their cached duplicates`
                    : `Delete ${selectedEntries.size} entries`
                }
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedEntries.size})
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={total === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={filters.query}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, query: e.target.value }))
                    }
                    className="w-full pl-10 pr-3 py-2 rounded-md border bg-background"
                  />
                </div>

                {/* Status */}
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: e.target.value as HistoryFilters["status"],
                    }))
                  }
                  className="px-3 py-2 rounded-md border bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="error">Errors</option>
                </select>

                {/* Date Range */}
                <select
                  value={filters.dateRange}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateRange: e.target.value as HistoryFilters["dateRange"],
                    }))
                  }
                  className="px-3 py-2 rounded-md border bg-background"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>

                {/* Threat Filter */}
                <select
                  value={filters.hasThreats}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      hasThreats: e.target
                        .value as HistoryFilters["hasThreats"],
                    }))
                  }
                  className="px-3 py-2 rounded-md border bg-background"
                >
                  <option value="all">All Files</option>
                  <option value="safe">Safe Only</option>
                  <option value="threats">Threats Only</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection Bar */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  disabled={selectedEntries.size === processedEntries.length}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedEntries.size === 0}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedEntries.size} of {processedEntries.length} selected
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : processedEntries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No scan history found</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {processedEntries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);
              const isClean =
                (entry.status === "completed" || entry.status === "reused") &&
                (!entry.report?.stats.malicious ||
                  entry.report.stats.malicious === 0);

              const hasMaliciousContent =
                entry.report?.stats.malicious &&
                entry.report.stats.malicious > 0;
              const uniqueEntry = entry as UniqueFileEntry;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="border rounded-lg bg-card overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpanded(entry.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectionMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(entry.id);
                            }}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {selectedEntries.has(entry.id) ? (
                              <CheckSquare className="h-5 w-5 text-primary" />
                            ) : (
                              <Square className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                        )}

                        <div className="p-2 bg-muted rounded-md">
                          {isClean ? (
                            <Shield className="h-5 w-5 text-green-500" />
                          ) : entry.status === "error" ? (
                            <ShieldAlert className="h-5 w-5 text-destructive" />
                          ) : hasMaliciousContent ? (
                            <ShieldAlert className="h-5 w-5 text-destructive" />
                          ) : (
                            <Shield className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div>
                          <h3 className="font-medium">{entry.fileName}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>{formatFileSize(entry.fileSize)}</span>
                            <span>•</span>
                            <span>{entry.fileType}</span>
                            {entry.zipFileName && (
                              <>
                                <span>•</span>
                                <span>from {entry.zipFileName}</span>
                              </>
                            )}
                            {showUniqueOnly &&
                              uniqueEntry.duplicateCount > 1 && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-600 font-medium">
                                    Scanned {uniqueEntry.duplicateCount} times
                                  </span>
                                </>
                              )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {getStatusBadge(entry)}
                          <p className="text-sm text-muted-foreground mt-1 flex items-center justify-end">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(entry.completedAt || entry.createdAt)}
                          </p>
                        </div>

                        {isClean && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(entry);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}

                        {!selectionMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingle(entry.id);
                            }}
                            className="text-destructive hover:text-destructive"
                            title={
                              showUniqueOnly && uniqueEntry.duplicateCount > 1
                                ? `Delete this file and ${
                                    uniqueEntry.duplicateCount - 1
                                  } cached duplicate${
                                    uniqueEntry.duplicateCount > 2 ? "s" : ""
                                  }`
                                : "Delete this entry"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t"
                      >
                        <div className="p-4 bg-muted/30">
                          {entry.status === "error" ? (
                            <div className="text-sm text-destructive">
                              <p className="font-medium">Error Details:</p>
                              <p>{entry.error || "Unknown error occurred"}</p>
                            </div>
                          ) : entry.report ? (
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-medium mb-2">
                                  Scan Results:
                                </p>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div className="bg-background rounded p-3">
                                    <p className="text-muted-foreground">
                                      Malicious
                                    </p>
                                    <p className="text-xl font-semibold text-destructive">
                                      {entry.report.stats.malicious}
                                    </p>
                                  </div>
                                  <div className="bg-background rounded p-3">
                                    <p className="text-muted-foreground">
                                      Suspicious
                                    </p>
                                    <p className="text-xl font-semibold text-yellow-500">
                                      {entry.report.stats.suspicious}
                                    </p>
                                  </div>
                                  <div className="bg-background rounded p-3">
                                    <p className="text-muted-foreground">
                                      Clean
                                    </p>
                                    <p className="text-xl font-semibold text-green-500">
                                      {entry.report.stats.harmless}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {entry.report.meta?.file_info && (
                                <div className="text-sm">
                                  <p className="font-medium mb-1">
                                    File Details:
                                  </p>
                                  <div className="font-mono text-xs bg-background rounded p-2">
                                    <p>
                                      SHA256:{" "}
                                      {entry.report.meta.file_info.sha256}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {entry.analysisId && (
                                <div className="text-sm">
                                  <a
                                    href={`https://www.virustotal.com/gui/file-analysis/${entry.analysisId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center"
                                  >
                                    View on VirusTotal
                                    <ChevronDown className="h-3 w-3 ml-1 -rotate-90" />
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {!showUniqueOnly && total > pageSize && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>

          <span className="text-sm text-muted-foreground px-4">
            Page {currentPage + 1} of {Math.ceil(total / pageSize)}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => prev + 1)}
            disabled={(currentPage + 1) * pageSize >= total}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center mb-4">
                <Trash2 className="h-6 w-6 text-destructive mr-3" />
                <h3 className="text-lg font-semibold">Confirm Delete</h3>
              </div>

              <p className="text-muted-foreground mb-6">
                {getDeleteConfirmationMessage()}
              </p>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={cancelDelete}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear All Confirmation Dialog */}
      <AnimatePresence>
        {showClearAllConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={cancelClearAll}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center mb-4">
                <Trash2 className="h-6 w-6 text-destructive mr-3" />
                <h3 className="text-lg font-semibold">Confirm Delete</h3>
              </div>

              <p className="text-muted-foreground mb-6">
                {showUniqueOnly
                  ? `Are you sure you want to delete ${
                      processedEntries.length
                    } unique ${
                      processedEntries.length === 1 ? "file" : "files"
                    } and all their cached duplicates (${total} total entries)? This action cannot be undone.`
                  : `Are you sure you want to delete all ${total} history ${
                      total === 1 ? "entry" : "entries"
                    }? This action cannot be undone.`}
              </p>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={cancelClearAll}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmClearAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
