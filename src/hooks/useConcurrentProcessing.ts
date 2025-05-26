/**
 * Concurrent processing hook for optimized queue processing
 * Handles multiple simultaneous uploads while respecting rate limits
 */

import { useCallback, useRef, useState } from "react";
import type { ScanTask } from "../types/index";
import { ConcurrentRateLimiter } from "../utils/concurrentRateLimiter";
import { RATE_LIMIT_CONFIG } from "../config/queueConfig";

export interface ConcurrentProcessingHook {
  isProcessing: boolean;
  startProcessing: () => void;
  stopProcessing: () => void;
  rateLimiter: ConcurrentRateLimiter;
  getProcessingStats: () => ProcessingStats;
}

export interface ProcessingStats {
  activeUploads: number;
  queuedTasks: number;
  completedTasks: number;
  rateLimitStatus: {
    activeRequests: number;
    pendingRequests: number;
    completedInWindow: number;
    totalInWindow: number;
    canMakeRequest: boolean;
    nextAvailableSlot: number;
  };
}

export function useConcurrentProcessing(
  getCurrentTasks: () => ScanTask[],
  processTask: (task: ScanTask, requestId: string) => Promise<void>,
  updateTaskStatus: (taskId: string, status: string) => void
): ConcurrentProcessingHook {
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const activeProcessors = useRef(new Set<string>());
  const processingLoopRunning = useRef(false);

  // Enhanced rate limiter with concurrent support
  const rateLimiter = useRef(
    new ConcurrentRateLimiter({
      requestLimit: RATE_LIMIT_CONFIG.REQUEST_LIMIT,
      requestWindow: RATE_LIMIT_CONFIG.REQUEST_WINDOW,
      minRequestSpacing: RATE_LIMIT_CONFIG.MIN_REQUEST_SPACING,
      maxConcurrent: 2, // Allow 2 concurrent uploads
      burstAllowance: 1, // Allow 1 extra request in burst
    })
  );

  // Get tasks prioritized for processing
  const getPrioritizedTasks = useCallback((): ScanTask[] => {
    const tasks = getCurrentTasks();
    const activeTasks = Array.from(activeProcessors.current);

    return tasks
      .filter(
        (task) => task.status === "pending" && !activeTasks.includes(task.id)
      )
      .sort((a, b) => {
        // Priority: smaller files first, then by upload time
        const sizeDiff = a.file.size - b.file.size;
        if (sizeDiff !== 0) return sizeDiff;
        return a.id.localeCompare(b.id);
      });
  }, [getCurrentTasks]);

  // Process a single task with rate limiting
  const processTaskWithRateLimit = useCallback(
    async (task: ScanTask): Promise<void> => {
      const taskId = task.id;

      try {
        activeProcessors.current.add(taskId);

        // Process the task without pre-allocating slots
        // The task processor will handle rate limiting internally
        console.log(
          `🔄 Processing task ${taskId} (${task.file.name}) in concurrent mode`
        );
        await processTask(task, `concurrent_${taskId}`);
        console.log(`✅ Completed task ${taskId}`);
      } catch (error) {
        console.error(`❌ Error processing task ${taskId}:`, error);
        updateTaskStatus(taskId, "error");
      } finally {
        activeProcessors.current.delete(taskId);
      }
    },
    [processTask, updateTaskStatus]
  );

  // Individual processor worker
  const runProcessor = useCallback(
    async (processorId: number): Promise<void> => {
      console.log(`🔧 Starting processor ${processorId}`);

      while (processingRef.current) {
        try {
          const prioritizedTasks = getPrioritizedTasks();

          if (prioritizedTasks.length === 0) {
            // No tasks available, wait and check again
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          // Get the next task for this processor
          const task = prioritizedTasks[0];
          if (!task) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          // Process the task
          await processTaskWithRateLimit(task);
        } catch (error) {
          console.error(`❌ Processor ${processorId} error:`, error);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      console.log(`🔧 Processor ${processorId} stopped`);
    },
    [getPrioritizedTasks, processTaskWithRateLimit]
  );

  // Start multiple concurrent processors
  const startConcurrentProcessors = useCallback(async (): Promise<void> => {
    const maxConcurrent = rateLimiter.current.getStatus().canMakeRequest
      ? 2
      : 1;
    const processors: Promise<void>[] = [];

    for (let i = 0; i < maxConcurrent; i++) {
      processors.push(runProcessor(i));
    }

    await Promise.all(processors);
  }, [runProcessor]);

  // Check if processing should stop
  const shouldStopProcessing = useCallback((): boolean => {
    const tasks = getCurrentTasks();
    const pendingTasks = tasks.filter((task) => task.status === "pending");
    const processingTasks = tasks.filter((task) =>
      ["hashing", "uploading", "scanning"].includes(task.status)
    );

    const shouldStop =
      pendingTasks.length === 0 &&
      processingTasks.length === 0 &&
      activeProcessors.current.size === 0;

    if (shouldStop) {
      console.log(
        `📊 Processing complete - Pending: ${pendingTasks.length}, Processing: ${processingTasks.length}, Active: ${activeProcessors.current.size}`
      );
    }

    return shouldStop;
  }, [getCurrentTasks]);

  // Main processing loop coordinator
  const runProcessingLoop = useCallback(async (): Promise<void> => {
    if (processingLoopRunning.current) return;

    processingLoopRunning.current = true;
    console.log("🚀 Starting concurrent processing loop");

    try {
      while (processingRef.current) {
        // Check if we should stop
        if (shouldStopProcessing()) {
          console.log("✅ All tasks completed, stopping processing");
          setIsProcessing(false);
          processingRef.current = false;
          break;
        }

        // Start concurrent processors
        await startConcurrentProcessors();

        // Brief pause before next cycle
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("❌ Error in concurrent processing loop:", error);
    } finally {
      processingLoopRunning.current = false;
      activeProcessors.current.clear();
      console.log("🛑 Concurrent processing loop ended");
    }
  }, [shouldStopProcessing, startConcurrentProcessors]);

  // Start processing
  const startProcessing = useCallback(() => {
    if (isProcessing) return;

    console.log("▶️ Starting concurrent processing");
    setIsProcessing(true);
    processingRef.current = true;
    runProcessingLoop();
  }, [isProcessing, runProcessingLoop]);

  // Stop processing
  const stopProcessing = useCallback(() => {
    console.log("⏹️ Stopping concurrent processing");
    setIsProcessing(false);
    processingRef.current = false;
    activeProcessors.current.clear();
  }, []);

  // Get processing statistics
  const getProcessingStats = useCallback((): ProcessingStats => {
    const tasks = getCurrentTasks();
    const rateLimitStatus = rateLimiter.current.getStatus();

    return {
      activeUploads: activeProcessors.current.size,
      queuedTasks: tasks.filter((t) => t.status === "pending").length,
      completedTasks: tasks.filter((t) =>
        ["completed", "error", "reused"].includes(t.status)
      ).length,
      rateLimitStatus,
    };
  }, [getCurrentTasks]);

  return {
    isProcessing,
    startProcessing,
    stopProcessing,
    rateLimiter: rateLimiter.current,
    getProcessingStats,
  };
}
