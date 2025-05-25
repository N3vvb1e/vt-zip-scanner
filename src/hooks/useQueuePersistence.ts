/**
 * Queue persistence hook
 * Handles auto-saving and loading queue state
 */

import { useEffect, useRef } from "react";
import type { ScanTask } from "../types/index";
import { persistenceService } from "../services/persistenceService";
import { SAVE_CONFIG } from "../config/queueConfig";

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
      console.log("🔧 Step 1: Initializing persistence service...");
      await persistenceService.init();
      console.log("✅ Step 1 completed");

      console.log("🔧 Step 2: Cleaning up invalid history entries...");
      const cleanedCount =
        await persistenceService.cleanupInvalidHistoryEntries();
      if (cleanedCount > 0) {
        console.log(`✅ Cleaned up ${cleanedCount} invalid history entries`);
      }
      console.log("✅ Step 2 completed");

      console.log("🔧 Step 3: Loading settings...");
      const settings = await persistenceService.getSettings();
      console.log("✅ Step 3 completed, settings:", settings);

      console.log("🔧 Step 4: Loading saved queue...");
      const savedTasks = await persistenceService.loadQueue();
      if (savedTasks.length > 0) {
        console.log(`Loaded ${savedTasks.length} tasks from storage`);
      }
      console.log("✅ Step 4 completed");

      console.log("🔧 Step 5: Setting initialized flag...");
      isInitialized.current = true;
      console.log("✅ Step 5 completed");

      const result = {
        savedTasks,
        autoStartEnabled: settings.autoStartScanning,
      };
      console.log(
        "🎉 useQueuePersistence initialization completed successfully"
      );
      return result;
    } catch (error) {
      console.error("❌ useQueuePersistence failed to initialize:", error);
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
            await persistenceService.saveQueue(activeTasks);
            lastSaveTime.current = now;
            markSaved();
            console.log(`📁 Auto-saved ${activeTasks.length} active tasks`);
          }
        } else {
          // Clear queue if no active tasks (only log once)
          const shouldLog =
            lastSaveTime.current === 0 || now - lastSaveTime.current > 60000; // Log max once per minute
          await persistenceService.saveQueue([]);
          lastSaveTime.current = now;
          markSaved();
          if (shouldLog) {
            console.log("📁 Cleared queue - no active tasks");
          }
        }
      } catch (error) {
        console.error("Failed to save queue:", error);
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
        persistenceService.saveQueue(tasks).catch(console.error);
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
