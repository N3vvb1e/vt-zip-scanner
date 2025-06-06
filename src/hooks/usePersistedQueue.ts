import { useState, useEffect, useRef } from "react";
import { useQueueState } from "./useQueueState";
import { useQueuePersistence } from "./useQueuePersistence";
import { useQueueProcessing } from "./useQueueProcessing";
import { useHistoryManager } from "./useHistoryManager";
import { useSettings } from "./useSettings";
import { logger } from "../utils/logger";

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
  const previousTaskIdsRef = useRef<string[]>([]);

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

  // Initialize persistence with processing state (for auto-save functionality)
  useQueuePersistence(
    queueState.tasks,
    queueState.hasUnsavedChanges,
    queueState.markSaved,
    processing.isProcessing,
    queueState.progress
  );

  // Detect task changes and cleanup old background operations
  useEffect(() => {
    const currentTaskIds = queueState.tasks.map((task) => task.id);
    const previousTaskIds = previousTaskIdsRef.current;

    // Check for different scenarios that require cleanup
    if (previousTaskIds.length > 0) {
      if (currentTaskIds.length === 0) {
        // Queue was cleared - cleanup all old tasks
        logger.debug("Queue cleared - cleaning up background operations", {
          oldTaskCount: previousTaskIds.length,
        });
        processing.cleanupOldTasks(previousTaskIds);
      } else if (currentTaskIds.length > 0) {
        const hasAnyCommonTasks = previousTaskIds.some((id) =>
          currentTaskIds.includes(id)
        );

        if (!hasAnyCommonTasks) {
          // Complete replacement detected - cleanup all old tasks
          logger.debug("Queue replacement detected", {
            oldTaskCount: previousTaskIds.length,
            newTaskCount: currentTaskIds.length,
          });
          processing.cleanupOldTasks(previousTaskIds);
        }
      }
    }

    // Update the reference for next comparison
    previousTaskIdsRef.current = currentTaskIds;
  }, [queueState.tasks, processing]);

  // Initialize persistence (run only once)
  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    const initializePersistence = async () => {
      try {
        // Direct initialization with persistence orchestrator
        const { persistenceOrchestrator } = await import(
          "../services/persistenceOrchestrator"
        );

        await persistenceOrchestrator.init();
        const settings_data = await persistenceOrchestrator.getSettings();
        const savedTasks = await persistenceOrchestrator.loadQueue();

        // Load saved tasks into queue state
        if (savedTasks.length > 0) {
          queueState.loadSavedTasks(savedTasks);
          logger.info("Loaded saved tasks", { count: savedTasks.length });
        }

        // Update settings with auto-start preference
        settings.updateSettings({
          autoStartScanning: settings_data.autoStartScanning,
        });

        setIsInitialized(true);
        logger.success("Persistence initialization completed successfully");
      } catch (error) {
        logger.error("Persistence initialization failed", error);
        // Set initialized anyway so app doesn't hang
        setIsInitialized(true);
      }
    };

    initializePersistence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
