/**
 * Queue processing hook
 * Orchestrates task processing using focused sub-hooks
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { ScanTask } from "../types/index";
import { RateLimiter } from "../utils/rateLimiter";
import { ConcurrentRateLimiter } from "../utils/concurrentRateLimiter";
import { RATE_LIMIT_CONFIG, PROCESSING_CONFIG } from "../config/queueConfig";
import { useTaskPolling } from "./useTaskPolling";
import { useTaskProcessor } from "./useTaskProcessor";
import { useConcurrentProcessing } from "./useConcurrentProcessing";
import { useProcessingLoop } from "./useProcessingLoop";
import { useTaskCompletion } from "./useTaskCompletion";

export interface QueueProcessingHook {
  isProcessing: boolean;
  startProcessing: () => void;
  stopProcessing: () => void;
  rateLimiter: RateLimiter | ConcurrentRateLimiter;
}

export function useQueueProcessing(
  tasks: ScanTask[],
  updateTask: (id: string, updates: Partial<ScanTask>) => void,
  addToHistory: (task: ScanTask) => Promise<void>,
  isInitialized: boolean
): QueueProcessingHook {
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize rate limiter
  const rateLimiter = useRef(
    new RateLimiter({
      requestLimit: RATE_LIMIT_CONFIG.REQUEST_LIMIT,
      requestWindow: RATE_LIMIT_CONFIG.REQUEST_WINDOW,
      minRequestSpacing: RATE_LIMIT_CONFIG.MIN_REQUEST_SPACING,
    })
  );

  // Processing state refs
  const processingRef = useRef(false);
  const currentlyProcessingRef = useRef<Set<string>>(new Set());
  const scanStartTimes = useRef<Map<string, number>>(new Map());

  // Keep a ref to the current tasks to avoid stale closure issues
  const tasksRef = useRef<ScanTask[]>(tasks);
  tasksRef.current = tasks;

  // Helper functions for accessing current state
  const getCurrentTasks = useCallback(() => tasksRef.current, []);
  const getCurrentlyProcessing = useCallback(
    () => currentlyProcessingRef.current,
    []
  );
  const getScanStartTimes = useCallback(() => scanStartTimes.current, []);
  const isProcessingActive = useCallback(() => processingRef.current, []);
  const setProcessingRef = useCallback((processing: boolean) => {
    processingRef.current = processing;
  }, []);

  // Rate limiter helper functions
  const canMakeRequest = useCallback(
    () => rateLimiter.current.canMakeRequest(),
    []
  );
  const recordRequest = useCallback(
    () => rateLimiter.current.recordRequest(),
    []
  );
  const getWaitTime = useCallback(() => rateLimiter.current.getWaitTime(), []);

  // Choose processing method based on configuration
  const useConcurrentMode = PROCESSING_CONFIG.ENABLE_CONCURRENT_PROCESSING;

  // Concurrent processing (optional)
  const concurrentProcessing = useConcurrentProcessing(
    getCurrentTasks,
    () => Promise.resolve(), // Placeholder, will be replaced
    (taskId: string, status: string) =>
      updateTask(taskId, {
        status: status as
          | "pending"
          | "hashing"
          | "uploading"
          | "scanning"
          | "completed"
          | "error"
          | "reused",
      })
  );

  // Initialize focused hooks
  const taskCompletion = useTaskCompletion(
    updateTask,
    addToHistory,
    getCurrentTasks,
    getCurrentlyProcessing,
    getScanStartTimes
  );

  const taskPolling = useTaskPolling(
    updateTask,
    taskCompletion.handleTaskCompleted,
    taskCompletion.handleTaskError,
    canMakeRequest,
    getWaitTime,
    isProcessingActive,
    getCurrentlyProcessing,
    getScanStartTimes
  );

  const taskProcessor = useTaskProcessor(
    updateTask,
    addToHistory,
    recordRequest,
    taskPolling.pollForResults,
    getCurrentTasks,
    getCurrentlyProcessing,
    getScanStartTimes,
    useConcurrentMode ? concurrentProcessing.rateLimiter : undefined
  );

  const processingLoop = useProcessingLoop(
    getCurrentTasks,
    getCurrentlyProcessing,
    taskProcessor.processTask,
    canMakeRequest,
    getWaitTime,
    isProcessingActive,
    setIsProcessing,
    setProcessingRef
  );

  // Start processing the queue
  const startProcessing = useCallback(() => {
    console.log(
      `Starting processing... (${
        useConcurrentMode ? "concurrent" : "sequential"
      } mode)`
    );
    setIsProcessing(true);
    processingRef.current = true;

    if (useConcurrentMode) {
      concurrentProcessing.startProcessing();
    }
  }, [useConcurrentMode, concurrentProcessing]);

  // Stop processing the queue
  const stopProcessing = useCallback(() => {
    console.log("Stopping processing...");
    setIsProcessing(false);
    processingRef.current = false;

    if (useConcurrentMode) {
      concurrentProcessing.stopProcessing();
    }
  }, [useConcurrentMode, concurrentProcessing]);

  // Start processing loop when enabled (only for sequential mode)
  useEffect(() => {
    if (
      isProcessing &&
      !useConcurrentMode &&
      !processingLoop.isLoopRunning() &&
      isInitialized
    ) {
      processingLoop.runProcessingLoop();
    }
  }, [isProcessing, useConcurrentMode, processingLoop, isInitialized]);

  return {
    isProcessing,
    startProcessing,
    stopProcessing,
    rateLimiter: useConcurrentMode
      ? concurrentProcessing.rateLimiter
      : rateLimiter.current,
  };
}
