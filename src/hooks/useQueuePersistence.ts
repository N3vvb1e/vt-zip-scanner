/**
 * Queue persistence hook
 * Handles auto-saving and loading queue state
 */

import { useEffect, useRef } from "react";
import type { ScanTask } from "../types/index";
import { persistenceOrchestrator } from "../services/persistenceOrchestrator";
import { SAVE_CONFIG } from "../config/queueConfig";
import { logger } from "../utils/logger";

export interface QueuePersistenceHook {
  isInitialized: boolean;
  initializePersistence: () => Promise<{
    savedTasks: ScanTask[];
    autoStartEnabled: boolean;
  }>;
}

export function useQueuePersistence(
  tasks: ScanTask[],
  hasUnsavedChanges: () => boolean,
  markSaved: () => void,
  isProcessing: boolean,
  progress: { percentage: number }
): QueuePersistenceHook {
  const lastSaveTime = useRef<number>(0);
  const isInitialized = useRef(false);

  // Initialize persistence service and load saved data
  const initializePersistence = async () => {
    try {
      logger.debug("Initializing persistence service");
      await persistenceOrchestrator.init();
      logger.success("Persistence service initialized");

      logger.debug("Cleaning up invalid history entries");
      const cleanedCount =
        await persistenceOrchestrator.cleanupInvalidHistoryEntries();
      if (cleanedCount > 0) {
        logger.success("History cleanup completed", { cleanedCount });
      }

      logger.debug("Loading settings");
      const settings = await persistenceOrchestrator.getSettings();
      logger.success("Settings loaded", settings);

      logger.debug("Loading saved queue");
      const savedTasks = await persistenceOrchestrator.loadQueue();
      if (savedTasks.length > 0) {
        logger.info("Tasks loaded from storage", {
          taskCount: savedTasks.length,
        });
      }

      logger.debug("Setting initialized flag");
      isInitialized.current = true;

      const result = {
        savedTasks,
        autoStartEnabled: settings.autoStartScanning,
      };
      logger.success("Queue persistence initialization completed");
      return result;
    } catch (error) {
      logger.error("Queue persistence initialization failed", error);
      isInitialized.current = true;
      return {
        savedTasks: [],
        autoStartEnabled: true,
      };
    }
  };

  // Auto-save queue state (optimized to reduce excessive saves)
  useEffect(() => {
    if (!isInitialized.current || !hasUnsavedChanges()) return;

    const saveQueue = async () => {
      const now = Date.now();
      // Use faster save interval for single files
      const saveInterval =
        tasks.length <= 1
          ? SAVE_CONFIG.SINGLE_FILE_SAVE_INTERVAL
          : SAVE_CONFIG.AUTO_SAVE_INTERVAL;
      if (now - lastSaveTime.current < saveInterval) return;

      try {
        // Only save pending/processing tasks, not completed ones
        const activeTasks = tasks.filter(
          (task) =>
            task.status === "pending" ||
            task.status === "hashing" ||
            task.status === "uploading" ||
            task.status === "scanning"
        );

        if (activeTasks.length > 0) {
          // Only save if tasks have meaningful status changes, not just scanning progress
          const hasStatusChanges = activeTasks.some(
            (task) =>
              task.status === "pending" ||
              task.status === "hashing" ||
              task.status === "uploading"
          );

          if (hasStatusChanges) {
            await persistenceOrchestrator.saveQueue(activeTasks);
            lastSaveTime.current = now;
            markSaved();
            logger.db("Auto-saved queue", "tasks", activeTasks.length);
          }
        } else {
          // Clear queue if no active tasks (only log once)
          const shouldLog =
            lastSaveTime.current === 0 || now - lastSaveTime.current > 60000; // Log max once per minute
          await persistenceOrchestrator.saveQueue([]);
          lastSaveTime.current = now;
          markSaved();
          if (shouldLog) {
            logger.db("Cleared queue - no active tasks");
          }
        }
      } catch (error) {
        logger.error("Failed to save queue", error);
      }
    };

    const timer = setInterval(saveQueue, SAVE_CONFIG.AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [tasks, hasUnsavedChanges, markSaved]);

  // Save immediately when processing stops or all tasks complete (debounced)
  useEffect(() => {
    if (!isInitialized.current) return;

    const shouldSave = !isProcessing || progress.percentage === 100;
    if (shouldSave && hasUnsavedChanges()) {
      // Debounce immediate saves to prevent excessive saves
      const timer = setTimeout(() => {
        persistenceOrchestrator
          .saveQueue(tasks)
          .catch((error) =>
            logger.error("Failed to save queue immediately", error)
          );
        markSaved();
      }, SAVE_CONFIG.IMMEDIATE_SAVE_DELAY);

      return () => clearTimeout(timer);
    }
  }, [isProcessing, progress.percentage, tasks, hasUnsavedChanges, markSaved]);

  return {
    isInitialized: isInitialized.current,
    initializePersistence,
  };
}
