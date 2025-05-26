import { useState, useEffect, useRef } from "react";
import { useQueueState } from "./useQueueState";
import { useQueuePersistence } from "./useQueuePersistence";
import { useQueueProcessing } from "./useQueueProcessing";
import { useHistoryManager } from "./useHistoryManager";
import { useSettings } from "./useSettings";

/**
 * Main orchestrator hook for the persisted queue system
 *
 * This hook coordinates multiple focused hooks to provide a clean API:
 * - useQueueState: Basic queue state management
 * - useQueuePersistence: Auto-save and persistence logic
 * - useQueueProcessing: Main processing loop and task execution
 * - useHistoryManager: History operations
 * - useSettings: Settings management
 *
 * DUPLICATE DETECTION FEATURE:
 * This system implements intelligent duplicate detection to save API quota:
 * 1. Before submitting files to VirusTotal, it calculates SHA-256 hashes
 * 2. Checks the local history database for files with matching hash + size
 * 3. If a match is found, reuses the existing scan result (status: "reused")
 * 4. If no match, proceeds with normal VirusTotal API submission
 */

export function usePersistedQueue() {
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationRef = useRef(false);

  // Use focused hooks for different concerns
  const queueState = useQueueState();
  const settings = useSettings();
  const historyManager = useHistoryManager();

  // Processing hook depends on other hooks
  const processing = useQueueProcessing(
    queueState.tasks,
    queueState.updateTask,
    historyManager.addToHistory,
    isInitialized
  );

  // Initialize persistence with processing state
  useQueuePersistence(
    queueState.tasks,
    queueState.hasUnsavedChanges,
    queueState.markSaved,
    processing.isProcessing,
    queueState.progress
  );

  // Initialize persistence and handle auto-start logic (run only once)
  useEffect(() => {
    if (initializationRef.current) return; // Already initialized
    initializationRef.current = true;

    let isMounted = true;

    const initializePersistence = async () => {
      console.log("🚀 Starting direct initialization test...");

      // Set a shorter timeout for testing
      setTimeout(() => {
        console.log("⏰ Timeout reached, setting initialized anyway");
        if (isMounted) {
          setIsInitialized(true);
        }
      }, 2000);

      try {
        // Test direct persistence service call
        console.log("🔧 Testing direct persistence service...");
        const { persistenceService } = await import(
          "../services/persistenceService"
        );

        console.log("🚀 Calling persistenceService.init()...");
        await persistenceService.init();
        console.log("✅ Direct persistence service init completed");

        console.log("🔧 Calling persistenceService.getSettings()...");
        const settings = await persistenceService.getSettings();
        console.log("✅ Direct settings loaded:", settings);

        console.log("🔧 Setting isInitialized to true directly");
        setIsInitialized(true);
        console.log("✨ Direct initialization completed successfully");
      } catch (error) {
        console.error("❌ Direct initialization failed:", error);
        if (isMounted) {
          console.log("🔧 Setting isInitialized to true despite error");
          setIsInitialized(true);
        }
      }
    };

    initializePersistence();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - run only once on mount

  // Return the orchestrated API from all hooks
  return {
    // Queue operations from queueState
    tasks: queueState.tasks,
    addTask: queueState.addTask,
    addTasks: queueState.addTasks,
    replaceTasks: queueState.replaceTasks,
    removeTask: queueState.removeTask,
    clearQueue: queueState.clearQueue,
    clearCompletedTasks: queueState.clearCompletedTasks,
    progress: queueState.progress,
    updateTask: queueState.updateTask,

    // Processing operations from processing
    isProcessing: processing.isProcessing,
    startProcessing: processing.startProcessing,
    stopProcessing: processing.stopProcessing,
    rateLimiter: processing.rateLimiter,

    // Persistence state
    isInitialized,

    // Settings from settings
    autoStartEnabled: settings.autoStartEnabled,
    updateSettings: settings.updateSettings,

    // History operations from historyManager
    historyEntries: historyManager.historyEntries,
    historyTotal: historyManager.historyTotal,
    historyLoading: historyManager.historyLoading,
    loadHistory: historyManager.loadHistory,
    deleteHistoryEntry: historyManager.deleteHistoryEntry,
    deleteHistoryEntries: historyManager.deleteHistoryEntries,
    clearHistory: historyManager.clearHistory,
    getHistoryFile: historyManager.getHistoryFile,

    // Storage stats from historyManager
    getStorageStats: historyManager.getStorageStats,
    exportData: historyManager.exportData,
  };
}
