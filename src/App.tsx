import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, Info } from "lucide-react";

import { FileDropzone } from "./components/scanner/FileDropzone";
import { TaskCard } from "./components/scanner/TaskCard";
import { QueueSummary } from "./components/scanner/QueueSummary";
import { Button } from "./components/ui/Button";
import { useQueue } from "./hooks/useQueue";
import type { FileEntry, ScanTask } from "./types";
import { createSafeZip } from "./utils/zipUtils";
import { validateApiKey } from "./services/virusTotalService";

function App() {
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [hasFiles, setHasFiles] = useState(false);

  const {
    tasks,
    addTasks,
    removeTask,
    clearQueue,
    isProcessing,
    startProcessing,
    stopProcessing,
    progress,
  } = useQueue();

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
      addTasks(files);
      setHasFiles(true);
      startProcessing(); // Auto-start scanning
    },
    [addTasks, startProcessing]
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
    // Get safe files (completed with no malicious detections)
    const safeFiles = tasks
      .filter(
        (task) =>
          task.status === "completed" &&
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

  // If API key check hasn't completed yet
  if (apiKeyValid === null) {
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

          {hasFiles && (
            <Button variant="ghost" onClick={handleReset}>
              Upload New ZIP
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {!hasFiles ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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

                <AnimatePresence>
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onRemove={removeTask}
                      onDownload={handleDownloadFile}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
