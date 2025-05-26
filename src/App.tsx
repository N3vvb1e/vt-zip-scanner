import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Info, Settings } from "lucide-react";

import { FileDropzone } from "./components/scanner/FileDropzone";
import { TaskCard } from "./components/scanner/TaskCard";
import { QueueSummary } from "./components/scanner/QueueSummary";
import { Button } from "./components/ui/Button";
import { usePersistedQueue } from "./hooks/usePersistedQueue";
import { HistoryView } from "./components/scanner/HistoryView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { FileEntry, ScanTask } from "./types";
import { createSafeZip } from "./utils/secureZipUtils";
import { validateApiKey } from "./services/virusTotalService";
import { generateId } from "./utils/common";

function App() {
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [hasFiles, setHasFiles] = useState(false);
  const [activeView, setActiveView] = useState<"queue" | "history">("queue");
  const [showSettings, setShowSettings] = useState(false);

  const {
    tasks,
    replaceTasks,
    removeTask,
    clearQueue,
    isProcessing,
    startProcessing,
    stopProcessing,
    progress,
    isInitialized,
    autoStartEnabled,
    updateSettings,
    historyEntries,
    historyTotal,
    historyLoading,
    loadHistory,
    deleteHistoryEntry,
    deleteHistoryEntries,
    clearHistory,
    getHistoryFile,
    getStorageStats,
  } = usePersistedQueue();

  // Load storage stats for history view
  const [storageStats, setStorageStats] = useState<
    | {
        historyCount: number;
        filesCount: number;
        estimatedSize?: number;
        actualFileSize?: number;
      }
    | undefined
  >();

  useEffect(() => {
    if (activeView === "history") {
      getStorageStats().then(setStorageStats).catch(console.error);
    }
  }, [activeView, historyEntries, getStorageStats]);

  // Update hasFiles state when tasks change (handles page refresh)
  useEffect(() => {
    const hasTasksNow = tasks.length > 0;

    // Only update hasFiles if we're initialized
    if (isInitialized) {
      setHasFiles(hasTasksNow);
    }
  }, [tasks.length, isInitialized]);

  // Check if API key is valid on mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const isValid = await validateApiKey();
        setApiKeyValid(isValid);
      } catch (error) {
        console.error("Error validating API key:", error);
        setApiKeyValid(false);
      }
    };

    checkApiKey();
  }, []);

  // Handle file extraction from zip
  const handleFilesExtracted = useCallback(
    (files: FileEntry[]) => {
      // Replace existing queue with new files
      replaceTasks(files);
      setHasFiles(true);
      if (autoStartEnabled) {
        startProcessing();
      }
    },
    [replaceTasks, startProcessing, autoStartEnabled]
  );

  // Download a single file
  const handleDownloadFile = useCallback((task: ScanTask) => {
    if (!task.file.blob) return;

    const url = URL.createObjectURL(task.file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = task.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Download all safe files
  const handleDownloadAll = useCallback(async () => {
    // Get safe files (completed or reused with no malicious detections)
    const safeFiles = tasks
      .filter(
        (task) =>
          (task.status === "completed" || task.status === "reused") &&
          task.report?.stats.malicious === 0 &&
          task.file.blob
      )
      .map((task) => task.file);

    if (safeFiles.length === 0) return;

    try {
      // Create a new ZIP with safe files
      const safeZip = await createSafeZip(safeFiles);

      // Trigger download
      const url = URL.createObjectURL(safeZip);
      const a = document.createElement("a");
      a.href = url;
      a.download = "safe_files.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating safe ZIP:", error);
      alert("Failed to create ZIP file with safe files");
    }
  }, [tasks]);

  // Reset the app state
  const handleReset = useCallback(() => {
    clearQueue();
    setHasFiles(false);
  }, [clearQueue]);

  // Add history download handler
  const handleHistoryDownload = useCallback(
    async (fileId: string, fileName: string) => {
      const blob = await getHistoryFile(fileId);
      if (!blob) {
        alert("File not found in history");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [getHistoryFile]
  );

  // Add bulk history download handler
  const handleHistoryBulkDownload = useCallback(
    async (entryIds: string[]) => {
      if (entryIds.length === 0) return;

      try {
        // Get all the files for the selected entries
        const fileEntries: { fileName: string; blob: Blob }[] = [];

        for (const entryId of entryIds) {
          const entry = historyEntries.find((e) => e.id === entryId);
          if (!entry) continue;

          const blob = await getHistoryFile(entry.fileId);
          if (blob) {
            fileEntries.push({
              fileName: entry.fileName,
              blob: blob,
            });
          }
        }

        if (fileEntries.length === 0) {
          alert("No files found for download");
          return;
        }

        if (fileEntries.length === 1) {
          // Single file - download directly
          const { fileName, blob } = fileEntries[0];
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          // Multiple files - create ZIP
          const { createSafeZip } = await import("./utils/secureZipUtils");

          // Convert to FileEntry format for createSafeZip
          const files = fileEntries.map(({ fileName, blob }) => ({
            id: generateId(),
            name: fileName,
            path: fileName,
            size: blob.size,
            type: blob.type || "application/octet-stream",
            blob: blob,
          }));

          const safeZip = await createSafeZip(files);

          // Trigger download
          const url = URL.createObjectURL(safeZip);
          const a = document.createElement("a");
          a.href = url;
          a.download = `safe_files_${
            new Date().toISOString().split("T")[0]
          }.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error("Error downloading selected files:", error);
        alert("Failed to download selected files");
      }
    },
    [historyEntries, getHistoryFile]
  );

  // Toggle auto-start setting
  const handleToggleAutoStart = useCallback(async () => {
    await updateSettings({ autoStartScanning: !autoStartEnabled });
  }, [autoStartEnabled, updateSettings]);

  // If API key check hasn't completed yet or not initialized
  if (apiKeyValid === null || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center p-8">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-lg">Initializing scanner...</p>
        </div>
      </div>
    );
  }

  // If API key is not valid
  if (apiKeyValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full p-6 bg-card rounded-lg shadow-lg">
          <div className="flex flex-col items-center text-center">
            <Shield className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">API Key Error</h1>
            <p className="text-muted-foreground mb-6">
              Your VirusTotal API key is missing or invalid. Please set a valid
              API key in your environment variables.
            </p>
            <div className="bg-muted p-4 rounded-md text-left w-full mb-4">
              <p className="font-mono text-sm">
                VITE_VT_API_KEY=your_api_key_here
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              You can get a free API key by signing up at{" "}
              <a
                href="https://www.virustotal.com/gui/join-us"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                VirusTotal.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-6 w-6 text-primary mr-2" />
            <h1 className="text-xl font-bold">VirusTotal ZIP Scanner</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Navigation tabs */}
            <div className="flex gap-2">
              <Button
                variant={activeView === "queue" ? "default" : "ghost"}
                onClick={() => setActiveView("queue")}
              >
                Queue
              </Button>
              <Button
                variant={activeView === "history" ? "default" : "ghost"}
                onClick={() => setActiveView("history")}
              >
                History
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {hasFiles && activeView === "queue" && (
              <Button variant="ghost" onClick={handleReset}>
                Upload New ZIP
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b bg-muted/30 overflow-hidden"
          >
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Settings</h3>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autoStartEnabled}
                      onChange={handleToggleAutoStart}
                      className="rounded"
                    />
                    Auto-start scanning when files are uploaded
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="container mx-auto px-4 py-8">
        {activeView === "queue" ? (
          !hasFiles ? (
            <div key="upload">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Scan a ZIP file</h2>
                <p className="text-muted-foreground mb-4">
                  Upload a ZIP file to scan all contained files with VirusTotal.
                </p>
              </div>

              <FileDropzone onFilesExtracted={handleFilesExtracted} />

              <div className="mt-8 max-w-2xl mx-auto">
                <div className="bg-muted rounded-lg p-4 flex items-start">
                  <Info className="h-5 w-5 text-primary mr-3 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Rate Limits Apply</p>
                    <p className="text-muted-foreground mt-1">
                      VirusTotal public API is limited to 4 requests per minute
                      and 500 per day. Files will be processed in queue
                      respecting these limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div key="results">
              <ErrorBoundary
                title="Queue Error"
                description="There was an error with the scanning queue. This might be due to a large number of files or a processing issue."
              >
                <QueueSummary
                  tasks={tasks}
                  progress={progress}
                  isProcessing={isProcessing}
                  onStartProcessing={startProcessing}
                  onStopProcessing={stopProcessing}
                  onClearQueue={clearQueue}
                  onDownloadAll={handleDownloadAll}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-medium">
                      Files ({tasks.length})
                    </h2>

                    <div className="flex items-center text-sm text-muted-foreground">
                      <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                      <span>Powered by VirusTotal API</span>
                    </div>
                  </div>

                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onRemove={removeTask}
                      onDownload={handleDownloadFile}
                    />
                  ))}
                </div>
              </ErrorBoundary>
            </div>
          )
        ) : (
          <div key="history">
            <HistoryView
              entries={historyEntries}
              total={historyTotal}
              loading={historyLoading}
              onLoadHistory={loadHistory}
              onDeleteHistoryEntry={deleteHistoryEntry}
              onDeleteHistoryEntries={deleteHistoryEntries}
              onClearHistory={clearHistory}
              onDownloadFile={handleHistoryDownload}
              onDownloadSelectedFiles={handleHistoryBulkDownload}
              storageStats={storageStats}
            />
          </div>
        )}
      </main>

      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            VirusTotal ZIP Scanner • Built with React & Vite
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
