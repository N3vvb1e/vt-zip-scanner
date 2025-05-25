import { useState, useEffect, useCallback, useRef } from "react";
import type { ScanTask, FileEntry, TaskStatus } from "../types/index";
import { submitFile, getReport } from "../services/virusTotalService";
import {
  persistenceService,
  type HistoryEntry,
  type SearchOptions,
} from "../services/persistenceService";
import { generateId, calculateFileHashes } from "../utils/common";

// VirusTotal rate limit: 4 requests per minute
const REQUEST_LIMIT = 4;
const REQUEST_WINDOW = 60 * 1000; // 60 seconds in milliseconds
const POLL_INTERVAL = 15000; // 15 seconds between polling for results
const RATE_LIMITED_POLL_INTERVAL = 60000; // 1 minute when rate limited

/**
 * DUPLICATE DETECTION FEATURE:
 *
 * This hook implements intelligent duplicate detection to save API quota:
 * 1. Before submitting files to VirusTotal, it calculates SHA-256 hashes
 * 2. Checks the local history database for files with matching hash + size
 * 3. If a match is found, reuses the existing scan result (status: "reused")
 * 4. If no match, proceeds with normal VirusTotal API submission
 *
 * This prevents unnecessary API calls for files that have already been scanned,
 * significantly reducing API quota consumption for duplicate files.
 */

// Auto-save interval (increased to reduce excessive saves)
const AUTO_SAVE_INTERVAL = 15000; // Save queue state every 15 seconds

export function usePersistedQueue() {
  const [tasks, setTasks] = useState<ScanTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  const requestTimestamps = useRef<number[]>([]);
  const processingRef = useRef(false);
  const currentlyProcessingRef = useRef<Set<string>>(new Set());
  const processingLoopRunning = useRef(false);
  const lastSaveTime = useRef<number>(0);
  const hasUnsavedChanges = useRef(false);

  // History state
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Track how many tasks are completed for progress calculation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (task) =>
      task.status === "completed" ||
      task.status === "error" ||
      task.status === "reused"
  ).length;

  const progress = {
    total: totalTasks,
    completed: completedTasks,
    percentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
  };

  // Initialize persistence service and load saved data
  useEffect(() => {
    const initializePersistence = async () => {
      try {
        await persistenceService.init();

        // Clean up invalid history entries that can't be used for duplicate detection
        console.log("🧹 Cleaning up invalid history entries...");
        const cleanedCount =
          await persistenceService.cleanupInvalidHistoryEntries();
        if (cleanedCount > 0) {
          console.log(`✅ Cleaned up ${cleanedCount} invalid history entries`);
        }

        // Load settings
        const settings = await persistenceService.getSettings();
        setAutoStartEnabled(settings.autoStartScanning);

        // Load saved queue
        const savedTasks = await persistenceService.loadQueue();
        if (savedTasks.length > 0) {
          console.log(`Loaded ${savedTasks.length} tasks from storage`);

          // Add a small delay to prevent race conditions during initialization
          await new Promise((resolve) => setTimeout(resolve, 100));

          setTasks(savedTasks);

          // Auto-start if enabled and there are pending tasks
          const hasPending = savedTasks.some((t) => t.status === "pending");
          const hasCompleted = savedTasks.some((t) => t.status === "completed");

          console.log(
            `Loaded tasks: ${savedTasks.length} total, pending: ${hasPending}, completed: ${hasCompleted}`
          );

          // Only auto-start if there are actually pending tasks to process
          if (settings.autoStartScanning && hasPending && !hasCompleted) {
            console.log("Auto-starting processing for pending tasks");
            // Add delay to ensure UI is ready
            setTimeout(() => {
              setIsProcessing(true);
              processingRef.current = true;
            }, 500);
          } else if (hasCompleted && !hasPending) {
            console.log(
              "All loaded tasks are already completed, not auto-starting"
            );
          }
        }

        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize persistence:", error);
        setIsInitialized(true); // Continue without persistence
      }
    };

    initializePersistence();
  }, []);

  // Auto-save queue state
  useEffect(() => {
    if (!isInitialized || !hasUnsavedChanges.current) return;

    const saveQueue = async () => {
      const now = Date.now();
      if (now - lastSaveTime.current < AUTO_SAVE_INTERVAL) return;

      try {
        await persistenceService.saveQueue(tasks);
        lastSaveTime.current = now;
        hasUnsavedChanges.current = false;
      } catch (error) {
        console.error("Failed to save queue:", error);
      }
    };

    const timer = setInterval(saveQueue, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [tasks, isInitialized]);

  // Save immediately when processing stops or all tasks complete (debounced)
  useEffect(() => {
    if (!isInitialized) return;

    const shouldSave = !isProcessing || progress.percentage === 100;
    if (shouldSave && hasUnsavedChanges.current) {
      // Debounce immediate saves to prevent excessive saves
      const timer = setTimeout(() => {
        persistenceService.saveQueue(tasks).catch(console.error);
        hasUnsavedChanges.current = false;
      }, 1000); // 1 second delay

      return () => clearTimeout(timer);
    }
  }, [isProcessing, progress.percentage, tasks, isInitialized]);

  // Helper functions
  const canMakeRequest = () => {
    const now = Date.now();
    const recentRequests = requestTimestamps.current.filter(
      (time) => now - time < REQUEST_WINDOW
    );
    requestTimestamps.current = recentRequests;
    return recentRequests.length < REQUEST_LIMIT;
  };

  const recordRequest = () => {
    requestTimestamps.current.push(Date.now());
  };

  const getWaitTime = () => {
    const now = Date.now();
    const recentRequests = requestTimestamps.current.filter(
      (time) => now - time < REQUEST_WINDOW
    );
    if (recentRequests.length < REQUEST_LIMIT) return 0;
    const oldestRequest = Math.min(...recentRequests);
    return REQUEST_WINDOW - (now - oldestRequest) + 1000;
  };

  // Add a new task to the queue
  const addTask = useCallback((file: FileEntry, zipFileName?: string) => {
    try {
      const newTask: ScanTask = {
        id: generateId(),
        file,
        status: "pending" as TaskStatus,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add zipFileName to track source
      if (zipFileName) {
        (newTask as ScanTask & { zipFileName?: string }).zipFileName =
          zipFileName;
      }

      setTasks((prevTasks) => [...prevTasks, newTask]);
      hasUnsavedChanges.current = true;
    } catch (error) {
      console.error("Error in addTask:", error);
    }
  }, []);

  // Add multiple tasks at once
  const addTasks = useCallback((files: FileEntry[], zipFileName?: string) => {
    const newTasks = files.map((file) => {
      const task: ScanTask = {
        id: generateId(),
        file,
        status: "pending" as TaskStatus,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (zipFileName) {
        (task as ScanTask & { zipFileName?: string }).zipFileName = zipFileName;
      }

      return task;
    });

    setTasks((prevTasks) => [...prevTasks, ...newTasks]);
    hasUnsavedChanges.current = true;
  }, []);

  // Replace all tasks (used when uploading new files)
  const replaceTasks = useCallback(
    (files: FileEntry[], zipFileName?: string) => {
      const newTasks = files.map((file) => {
        const task: ScanTask = {
          id: generateId(),
          file,
          status: "pending" as TaskStatus,
          progress: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (zipFileName) {
          (task as ScanTask & { zipFileName?: string }).zipFileName =
            zipFileName;
        }

        return task;
      });

      console.log(`Replacing queue with ${newTasks.length} new tasks`);
      setTasks(newTasks);
      hasUnsavedChanges.current = true;
    },
    []
  );

  // Remove a task from the queue
  const removeTask = useCallback((id: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    currentlyProcessingRef.current.delete(id);
    hasUnsavedChanges.current = true;
  }, []);

  // Clear all tasks
  const clearQueue = useCallback(async () => {
    setIsProcessing(false);
    processingRef.current = false;
    processingLoopRunning.current = false;
    currentlyProcessingRef.current.clear();
    setTasks([]);
    hasUnsavedChanges.current = false;

    // Clear from storage
    try {
      await persistenceService.clearQueue();
    } catch (error) {
      console.error("Failed to clear queue from storage:", error);
    }
  }, []);

  // Clear only completed tasks (keep pending/processing ones)
  const clearCompletedTasks = useCallback(async () => {
    console.log("Clearing completed tasks");
    setTasks((prevTasks) =>
      prevTasks.filter(
        (task) => task.status !== "completed" && task.status !== "error"
      )
    );
    hasUnsavedChanges.current = true;
  }, []);

  // Start processing the queue
  const startProcessing = useCallback(() => {
    console.log("Starting processing...");
    setIsProcessing(true);
    processingRef.current = true;
  }, []);

  // Stop processing the queue
  const stopProcessing = useCallback(() => {
    console.log("Stopping processing...");
    setIsProcessing(false);
    processingRef.current = false;
    processingLoopRunning.current = false;
  }, []);

  // Helper to update a task
  const updateTask = useCallback((id: string, updates: Partial<ScanTask>) => {
    try {
      setTasks((prevTasks) => {
        if (!Array.isArray(prevTasks)) {
          console.error("updateTask: prevTasks is not an array", prevTasks);
          return [];
        }

        return prevTasks
          .map((task) => {
            if (!task || !task.id) {
              console.warn("updateTask: Found invalid task", task);
              return task;
            }

            return task.id === id
              ? { ...task, ...updates, updatedAt: new Date() }
              : task;
          })
          .filter(Boolean); // Remove any null/undefined tasks
      });
      hasUnsavedChanges.current = true;
    } catch (error) {
      console.error("Error in updateTask:", error, { id, updates });
    }
  }, []);

  // Add completed task to history
  const addToHistory = useCallback(async (task: ScanTask) => {
    try {
      await persistenceService.addToHistory(task);
      // Note: History will be refreshed when user navigates to history view
    } catch (error) {
      console.error("Failed to add task to history:", error);
    }
  }, []);

  // Poll for scan results with rate limiting
  const pollForResults = useCallback(
    async (taskId: string, analysisId: string, retryCount = 0) => {
      if (!processingRef.current) {
        currentlyProcessingRef.current.delete(taskId);
        return;
      }

      if (!canMakeRequest()) {
        const waitTime = getWaitTime();
        console.log(
          `Rate limit hit during polling for ${taskId}, waiting ${waitTime}ms`
        );
        setTimeout(
          () => pollForResults(taskId, analysisId, retryCount),
          waitTime
        );
        return;
      }

      try {
        recordRequest();
        const report = await getReport(analysisId);

        if (report && Object.keys(report.results || {}).length > 0) {
          console.log(`Scan completed for task ${taskId}`);

          // Update task with a small delay to prevent race conditions
          let completedTask: ScanTask | undefined;

          await new Promise<void>((resolve) => {
            setTasks((prevTasks) => {
              if (!Array.isArray(prevTasks)) {
                console.error(
                  "pollForResults: prevTasks is not an array",
                  prevTasks
                );
                resolve();
                return [];
              }

              const updatedTasks = prevTasks.map((task) => {
                if (task?.id === taskId) {
                  // Enhance the report with local file hash if VirusTotal doesn't provide it
                  const enhancedReport = { ...report };
                  if (!enhancedReport.meta?.file_info && task.file.sha256) {
                    enhancedReport.meta = {
                      file_info: {
                        sha256: task.file.sha256,
                        sha1: "", // Not available locally
                        md5: "", // Not available locally
                        size: task.file.size,
                        file_type: task.file.type,
                        filename: task.file.name,
                      },
                    };
                    console.log(
                      `🔧 Enhanced report with local file hash for ${task.file.name}`
                    );
                  }

                  completedTask = {
                    ...task,
                    status: "completed" as TaskStatus,
                    progress: 100,
                    report: enhancedReport,
                    updatedAt: new Date(),
                  };
                  return completedTask;
                }
                return task;
              });

              // Small delay before resolving to let React process the update
              setTimeout(resolve, 100);
              return updatedTasks;
            });
          });

          currentlyProcessingRef.current.delete(taskId);
          hasUnsavedChanges.current = true;

          // Add to history with error handling (but keep task in queue for UI)
          if (completedTask) {
            try {
              await addToHistory(completedTask);
              console.log(
                `Task ${taskId} added to history but kept in queue for UI`
              );
            } catch (error) {
              console.error("Error adding completed task to history:", error);
            }
          }
        } else {
          console.log(
            `Scan still in progress for task ${taskId}, polling again in ${POLL_INTERVAL}ms`
          );
          setTimeout(
            () => pollForResults(taskId, analysisId, retryCount),
            POLL_INTERVAL
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message === "RATE_LIMIT") {
          console.log(
            `Rate limited while polling for task ${taskId}, waiting longer`
          );
          setTimeout(
            () => pollForResults(taskId, analysisId, retryCount),
            RATE_LIMITED_POLL_INTERVAL
          );
        } else {
          console.error(`Error polling for results for task ${taskId}:`, error);
          if (retryCount < 3) {
            console.log(
              `Retrying polling for task ${taskId} (attempt ${
                retryCount + 1
              }/3)`
            );
            setTimeout(
              () => pollForResults(taskId, analysisId, retryCount + 1),
              POLL_INTERVAL * 2
            );
          } else {
            // Mark as error and add to history
            let errorTask: ScanTask | undefined;
            setTasks((prevTasks) => {
              const updatedTasks = prevTasks.map((task) => {
                if (task.id === taskId) {
                  errorTask = {
                    ...task,
                    status: "error" as TaskStatus,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                    updatedAt: new Date(),
                  };
                  return errorTask;
                }
                return task;
              });
              return updatedTasks;
            });

            currentlyProcessingRef.current.delete(taskId);
            hasUnsavedChanges.current = true;

            // Add to history but keep in queue for UI
            if (errorTask) {
              try {
                await addToHistory(errorTask);
                console.log(
                  `Error task ${taskId} added to history but kept in queue for UI`
                );
              } catch (error) {
                console.error("Error adding error task to history:", error);
              }
            }
          }
        }
      }
    },
    [addToHistory]
  );

  // Main processing loop
  const runProcessingLoop = useCallback(async () => {
    if (!processingRef.current || processingLoopRunning.current) {
      return;
    }

    processingLoopRunning.current = true;
    console.log("Starting processing loop");

    const processNextAvailableTask = async (): Promise<boolean> => {
      // Get current tasks
      let currentTasks: ScanTask[] = [];
      await new Promise<void>((resolve) => {
        setTasks((prevTasks) => {
          currentTasks = prevTasks;
          resolve();
          return prevTasks;
        });
      });

      // Find next pending task
      const pendingTasks = currentTasks.filter(
        (task) =>
          task.status === "pending" &&
          !currentlyProcessingRef.current.has(task.id)
      );

      if (pendingTasks.length === 0) {
        return false; // No tasks to process
      }

      if (!canMakeRequest()) {
        const waitTime = getWaitTime();
        console.log(
          `Rate limit hit, waiting ${waitTime}ms before processing next task`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return true; // Try again
      }

      const nextTask = pendingTasks[0];
      currentlyProcessingRef.current.add(nextTask.id);
      console.log(`Processing task ${nextTask.id}: ${nextTask.file.name}`);

      try {
        // Step 1: Calculate file hash for duplicate detection
        updateTask(nextTask.id, {
          status: "hashing" as TaskStatus,
          progress: 5,
        });

        console.log(`Calculating hash for: ${nextTask.file.name}`);
        const fileHashes = await calculateFileHashes(nextTask.file.blob!);

        // Step 2: Check for existing scan
        console.log(`Checking for existing scan of: ${nextTask.file.name}`);
        const existingScan = await persistenceService.findExistingScan(
          fileHashes.sha256,
          fileHashes.size
        );

        if (existingScan) {
          console.log(
            `✅ DUPLICATE DETECTED: Found existing scan for "${
              nextTask.file.name
            }" (SHA256: ${fileHashes.sha256.substring(
              0,
              16
            )}...), reusing result and saving API quota!`
          );

          // Reuse existing scan result
          const reusedTask: ScanTask = {
            ...nextTask,
            status: "reused" as TaskStatus,
            progress: 100,
            analysisId: existingScan.analysisId,
            report: existingScan.report,
            updatedAt: new Date(),
          };

          // Update file entry with hash
          reusedTask.file.sha256 = fileHashes.sha256;

          // Ensure the reused report has file_info for future duplicate detection
          if (reusedTask.report && !reusedTask.report.meta?.file_info) {
            reusedTask.report = {
              ...reusedTask.report,
              meta: {
                file_info: {
                  sha256: fileHashes.sha256,
                  sha1: "", // Not available locally
                  md5: "", // Not available locally
                  size: fileHashes.size,
                  file_type: nextTask.file.type,
                  filename: nextTask.file.name,
                },
              },
            };
            console.log(
              `🔧 Enhanced reused report with local file hash for ${nextTask.file.name}`
            );
          }

          updateTask(nextTask.id, {
            status: "reused" as TaskStatus,
            progress: 100,
            analysisId: existingScan.analysisId,
            report: reusedTask.report, // Use the enhanced report
            file: reusedTask.file, // Preserve the file with hash and blob
          });

          currentlyProcessingRef.current.delete(nextTask.id);
          await addToHistory(reusedTask);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return true;
        }

        // Step 3: No existing scan found, proceed with new scan

        updateTask(nextTask.id, {
          status: "uploading" as TaskStatus,
          progress: 10,
        });

        console.log(`Submitting file: ${nextTask.file.name}`);
        recordRequest();
        const analysisId = await submitFile(nextTask.file.blob!);

        console.log(`File submitted successfully, analysis ID: ${analysisId}`);

        // Update file entry with hash
        nextTask.file.sha256 = fileHashes.sha256;

        updateTask(nextTask.id, {
          analysisId,
          status: "scanning" as TaskStatus,
          progress: 50,
        });

        setTimeout(
          () => pollForResults(nextTask.id, analysisId),
          POLL_INTERVAL
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === "RATE_LIMIT") {
          updateTask(nextTask.id, {
            status: "pending" as TaskStatus,
            progress: 0,
          });
          currentlyProcessingRef.current.delete(nextTask.id);
          await new Promise((resolve) =>
            setTimeout(resolve, RATE_LIMITED_POLL_INTERVAL)
          );
          return true;
        } else {
          console.error(`Error processing task ${nextTask.id}:`, error);

          // Mark as error and add to history
          const errorTask: ScanTask = {
            ...nextTask,
            status: "error" as TaskStatus,
            error: error instanceof Error ? error.message : "Unknown error",
            progress: 0,
            updatedAt: new Date(),
          };

          updateTask(nextTask.id, {
            status: "error" as TaskStatus,
            error: errorTask.error,
            progress: 0,
          });

          currentlyProcessingRef.current.delete(nextTask.id);
          await addToHistory(errorTask);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return true;
        }
      }
    };

    // Main processing loop
    while (processingRef.current) {
      const hasWork = await processNextAvailableTask();
      if (!hasWork) {
        // No work to do, check if we should stop processing
        let currentTasks: ScanTask[] = [];
        await new Promise<void>((resolve) => {
          setTasks((prevTasks) => {
            currentTasks = prevTasks;
            resolve();
            return prevTasks;
          });
        });

        const pendingTasks = currentTasks.filter(
          (task) =>
            task.status === "pending" &&
            !currentlyProcessingRef.current.has(task.id)
        );

        const processingTasks = currentTasks.filter((task) =>
          ["hashing", "uploading", "scanning"].includes(task.status)
        );

        // If no pending tasks and no tasks currently being processed, stop processing
        if (
          pendingTasks.length === 0 &&
          processingTasks.length === 0 &&
          currentlyProcessingRef.current.size === 0
        ) {
          console.log("All tasks completed, stopping processing automatically");

          // Add a small delay to prevent race conditions with UI updates
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Double-check the state hasn't changed during the delay
          let finalTasks: ScanTask[] = [];
          await new Promise<void>((resolve) => {
            setTasks((prevTasks) => {
              finalTasks = prevTasks;
              resolve();
              return prevTasks;
            });
          });

          const finalPending = finalTasks.filter(
            (task) =>
              task?.status === "pending" &&
              !currentlyProcessingRef.current.has(task.id)
          );
          const finalProcessing = finalTasks.filter(
            (task) =>
              task?.status &&
              ["hashing", "uploading", "scanning"].includes(task.status)
          );

          // Only stop if still no work to do
          if (
            finalPending.length === 0 &&
            finalProcessing.length === 0 &&
            currentlyProcessingRef.current.size === 0
          ) {
            setIsProcessing(false);
            processingRef.current = false;
            break;
          }
        }

        // Wait before checking again
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    processingLoopRunning.current = false;
    console.log("Processing loop ended");
  }, [updateTask, pollForResults, addToHistory]);

  // Start processing loop when enabled
  useEffect(() => {
    if (isProcessing && !processingLoopRunning.current && isInitialized) {
      runProcessingLoop();
    }
  }, [isProcessing, runProcessingLoop, isInitialized]);

  // History management functions
  const loadHistory = useCallback(async (options: SearchOptions = {}) => {
    setHistoryLoading(true);
    try {
      const result = await persistenceService.getHistory(options);
      setHistoryEntries(result.entries);
      setHistoryTotal(result.total);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await persistenceService.clearHistory();
      setHistoryEntries([]);
      setHistoryTotal(0);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  }, []);

  const getHistoryFile = useCallback(
    async (fileId: string): Promise<Blob | null> => {
      try {
        return await persistenceService.getHistoryFile(fileId);
      } catch (error) {
        console.error("Failed to get file from history:", error);
        return null;
      }
    },
    []
  );

  // Settings management
  const updateSettings = useCallback(
    async (updates: { autoStartScanning?: boolean }) => {
      console.log("Updating settings:", updates);

      // Update UI state immediately for better UX
      if (updates.autoStartScanning !== undefined) {
        setAutoStartEnabled(updates.autoStartScanning);
        console.log("UI state updated to:", updates.autoStartScanning);
      }

      try {
        await persistenceService.updateSettings(updates);
        console.log("Settings successfully saved to database");
      } catch (error) {
        console.error("Failed to update settings:", error);
        // Revert UI state if database update failed
        if (updates.autoStartScanning !== undefined) {
          setAutoStartEnabled(!updates.autoStartScanning);
          console.log("Reverted UI state to:", !updates.autoStartScanning);
        }
      }
    },
    []
  );

  return {
    // Queue operations
    tasks,
    addTask,
    addTasks,
    replaceTasks,
    removeTask,
    clearQueue,
    clearCompletedTasks,
    isProcessing,
    startProcessing,
    stopProcessing,
    progress,
    updateTask,

    // Persistence state
    isInitialized,
    autoStartEnabled,
    updateSettings,

    // History operations
    historyEntries,
    historyTotal,
    historyLoading,
    loadHistory,
    clearHistory,
    getHistoryFile,

    // Storage stats
    getStorageStats: () => persistenceService.getStorageStats(),
    exportData: () => persistenceService.exportData(),
  };
}
