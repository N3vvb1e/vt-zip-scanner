/**
 * Processing loop hook
 * Handles the main queue processing orchestration
 */

import { useCallback, useRef } from "react";
import type { ScanTask } from "../types/index";
import { PROCESSING_CONFIG } from "../config/queueConfig";
import { logger } from "../utils/logger";

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
        (task) => task.status === "pending" && !currentlyProcessing.has(task.id)
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
      (task) => task.status === "pending" && !currentlyProcessing.has(task.id)
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
      logger.debug("Processing status check", {
        processingTasks: processingTasks.length,
        currentlyProcessing: currentlyProcessing.size,
      });
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
      logger.debug("Rate limit hit, waiting before processing", {
        waitTime: `${waitTime}ms`,
        taskId: nextTask.id,
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return true; // Try again
    }

    const currentlyProcessing = getCurrentlyProcessing();
    currentlyProcessing.add(nextTask.id);
    logger.scan("processing", nextTask.file.name, "started", {
      taskId: nextTask.id,
    });

    try {
      await processTask(nextTask);
      return true;
    } catch (error) {
      logger.error("Error in processNextTask", error, {
        taskId: nextTask.id,
        fileName: nextTask.file.name,
      });
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
    logger.info("Starting processing loop");

    try {
      // Main processing loop
      while (isProcessingActive()) {
        const currentTasks = getCurrentTasks();
        const pendingCount = currentTasks.filter(
          (task) =>
            task.status === "pending" && !getCurrentlyProcessing().has(task.id)
        ).length;

        logger.debug("Processing loop status", {
          pendingTasks: pendingCount,
          totalTasks: currentTasks.length,
        });

        // Try to process next task
        const hasWork = await processNextTask();

        if (!hasWork) {
          // No work available, check if we should stop
          if (shouldStopProcessing()) {
            logger.success(
              "All tasks completed, stopping processing automatically"
            );
            setIsProcessing(false);
            setProcessingRef(false);
            break;
          }

          // Wait before checking again
          const waitTime = getLoopWaitTime();
          logger.debug("No pending tasks, waiting before checking again", {
            waitTime: `${waitTime}ms`,
          });
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    } catch (error) {
      logger.error("Error in processing loop", error);
    } finally {
      processingLoopRunning.current = false;
      logger.info("Processing loop ended");
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
