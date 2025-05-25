/**
 * Processing loop hook
 * Handles the main queue processing orchestration
 */

import { useCallback, useRef } from "react";
import type { ScanTask } from "../types/index";
import { PROCESSING_CONFIG } from "../config/queueConfig";

export interface ProcessingLoopHook {
  runProcessingLoop: () => Promise<void>;
  isLoopRunning: () => boolean;
}

export function useProcessingLoop(
  getCurrentTasks: () => ScanTask[],
  getCurrentlyProcessing: () => Set<string>,
  processTask: (task: ScanTask) => Promise<void>,
  canMakeRequest: () => boolean,
  getWaitTime: () => number,
  isProcessingActive: () => boolean,
  setIsProcessing: (processing: boolean) => void,
  setProcessingRef: (processing: boolean) => void
): ProcessingLoopHook {
  const processingLoopRunning = useRef(false);

  const isLoopRunning = useCallback(() => {
    return processingLoopRunning.current;
  }, []);

  // Find next pending task (prioritize smaller files for faster processing)
  const getNextPendingTask = useCallback((): ScanTask | null => {
    const currentTasks = getCurrentTasks();
    const currentlyProcessing = getCurrentlyProcessing();

    const pendingTasks = currentTasks
      .filter(
        (task) =>
          task.status === "pending" && !currentlyProcessing.has(task.id)
      )
      .sort((a, b) => a.file.size - b.file.size); // Smaller files first

    return pendingTasks[0] || null;
  }, [getCurrentTasks, getCurrentlyProcessing]);

  // Check if processing should stop
  const shouldStopProcessing = useCallback((): boolean => {
    const currentTasks = getCurrentTasks();
    const currentlyProcessing = getCurrentlyProcessing();

    // No pending tasks
    const pendingTasks = currentTasks.filter(
      (task) =>
        task.status === "pending" && !currentlyProcessing.has(task.id)
    );

    // No tasks currently being processed
    const processingTasks = currentTasks.filter((task) =>
      ["hashing", "uploading", "scanning"].includes(task.status)
    );

    const shouldStop =
      pendingTasks.length === 0 &&
      processingTasks.length === 0 &&
      currentlyProcessing.size === 0;

    if (shouldStop) {
      console.log(
        `📊 Processing tasks: ${processingTasks.length}, Currently processing: ${currentlyProcessing.size}`
      );
    }

    return shouldStop;
  }, [getCurrentTasks, getCurrentlyProcessing]);

  // Calculate wait time based on current queue state
  const getLoopWaitTime = useCallback((): number => {
    const currentTasks = getCurrentTasks();
    return currentTasks.length <= 1
      ? PROCESSING_CONFIG.SINGLE_FILE_WAIT_TIME
      : PROCESSING_CONFIG.BATCH_WAIT_TIME;
  }, [getCurrentTasks]);

  // Process next available task
  const processNextTask = useCallback(async (): Promise<boolean> => {
    const nextTask = getNextPendingTask();
    
    if (!nextTask) {
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

    const currentlyProcessing = getCurrentlyProcessing();
    currentlyProcessing.add(nextTask.id);
    console.log(`Processing task ${nextTask.id}: ${nextTask.file.name}`);

    try {
      await processTask(nextTask);
      return true;
    } catch (error) {
      console.error(`Error in processNextTask for ${nextTask.id}:`, error);
      currentlyProcessing.delete(nextTask.id);
      return true;
    }
  }, [
    getNextPendingTask,
    canMakeRequest,
    getWaitTime,
    getCurrentlyProcessing,
    processTask,
  ]);

  // Main processing loop
  const runProcessingLoop = useCallback(async () => {
    if (!isProcessingActive() || processingLoopRunning.current) {
      return;
    }

    processingLoopRunning.current = true;
    console.log("Starting processing loop");

    try {
      // Main processing loop
      while (isProcessingActive()) {
        const currentTasks = getCurrentTasks();
        const pendingCount = currentTasks.filter(
          (task) =>
            task.status === "pending" &&
            !getCurrentlyProcessing().has(task.id)
        ).length;

        console.log(
          `🔍 Found ${pendingCount} pending tasks out of ${currentTasks.length} total tasks`
        );

        // Try to process next task
        const hasWork = await processNextTask();

        if (!hasWork) {
          // No work available, check if we should stop
          if (shouldStopProcessing()) {
            console.log("All tasks completed, stopping processing automatically");
            setIsProcessing(false);
            setProcessingRef(false);
            break;
          }

          // Wait before checking again
          const waitTime = getLoopWaitTime();
          console.log(
            `⏳ No pending tasks, waiting ${waitTime}ms before checking again`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    } catch (error) {
      console.error("Error in processing loop:", error);
    } finally {
      processingLoopRunning.current = false;
      console.log("Processing loop ended");
    }
  }, [
    isProcessingActive,
    getCurrentTasks,
    getCurrentlyProcessing,
    processNextTask,
    shouldStopProcessing,
    setIsProcessing,
    setProcessingRef,
    getLoopWaitTime,
  ]);

  return {
    runProcessingLoop,
    isLoopRunning,
  };
}
