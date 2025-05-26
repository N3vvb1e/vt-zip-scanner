/**
 * Queue processing hook
 * Orchestrates task processing using focused sub-hooks
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { ScanTask } from "../types/index";
import { RateLimiter } from "../utils/rateLimiter";
import { RATE_LIMIT_CONFIG } from "../config/queueConfig";
import { useTaskPolling } from "./useTaskPolling";
import { useTaskProcessor } from "./useTaskProcessor";
import { useProcessingLoop } from "./useProcessingLoop";
import { useTaskCompletion } from "./useTaskCompletion";

export interface QueueProcessingHook {
  isProcessing: boolean;
  startProcessing: () => void;
  stopProcessing: () => void;
  rateLimiter: RateLimiter;
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

  // Removed concurrent processing - using sequential processing only

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
    getScanStartTimes
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
    console.log("Starting processing...");
    setIsProcessing(true);
    processingRef.current = true;
  }, []);

  // Stop processing the queue
  const stopProcessing = useCallback(() => {
    console.log("Stopping processing...");
    setIsProcessing(false);
    processingRef.current = false;
  }, []);

  // Start processing loop when enabled
  useEffect(() => {
    if (isProcessing && !processingLoop.isLoopRunning() && isInitialized) {
      processingLoop.runProcessingLoop();
    }
  }, [isProcessing, processingLoop, isInitialized]);

  return {
    isProcessing,
    startProcessing,
    stopProcessing,
    rateLimiter: rateLimiter.current,
  };
}
