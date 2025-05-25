import { useState, useEffect, useCallback, useRef } from "react";
import type { ScanTask, FileEntry, TaskStatus } from "../types/index";
import { submitFile, getReport } from "../services/virusTotalService";
import { generateId } from "../utils/common";

// VirusTotal rate limit: 4 requests per minute
const REQUEST_LIMIT = 4;
const REQUEST_WINDOW = 60 * 1000; // 60 seconds in milliseconds
const POLL_INTERVAL = 15000; // 15 seconds between polling for results
const RATE_LIMITED_POLL_INTERVAL = 60000; // 1 minute when rate limited

export function useQueue() {
  const [tasks, setTasks] = useState<ScanTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const requestTimestamps = useRef<number[]>([]);
  const processingRef = useRef(false);
  const currentlyProcessingRef = useRef<Set<string>>(new Set());
  const processingLoopRunning = useRef(false);

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

  // Helper functions that don't depend on state
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
  const addTask = useCallback((file: FileEntry) => {
    const newTask: ScanTask = {
      id: generateId(),
      file,
      status: "pending" as TaskStatus,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
  }, []);

  // Add multiple tasks at once
  const addTasks = useCallback((files: FileEntry[]) => {
    const newTasks = files.map((file) => ({
      id: generateId(),
      file,
      status: "pending" as TaskStatus,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    setTasks((prevTasks) => [...prevTasks, ...newTasks]);
  }, []);

  // Remove a task from the queue
  const removeTask = useCallback((id: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    currentlyProcessingRef.current.delete(id);
  }, []);

  // Clear all tasks
  const clearQueue = useCallback(() => {
    console.log("Clearing queue and stopping processing");
    setIsProcessing(false);
    processingRef.current = false;
    processingLoopRunning.current = false;
    currentlyProcessingRef.current.clear();
    setTasks([]);
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
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );
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
          updateTask(taskId, {
            status: "completed" as TaskStatus,
            progress: 100,
            report,
            updatedAt: new Date(),
          });
          currentlyProcessingRef.current.delete(taskId);
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
            updateTask(taskId, {
              status: "error" as TaskStatus,
              error: error instanceof Error ? error.message : "Unknown error",
              updatedAt: new Date(),
            });
            currentlyProcessingRef.current.delete(taskId);
          }
        }
      }
    },
    [updateTask]
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
        updateTask(nextTask.id, {
          status: "uploading" as TaskStatus,
          progress: 10,
          updatedAt: new Date(),
        });

        console.log(`Submitting file: ${nextTask.file.name}`);
        recordRequest();
        const analysisId = await submitFile(nextTask.file.blob!);

        console.log(`File submitted successfully, analysis ID: ${analysisId}`);

        updateTask(nextTask.id, {
          analysisId,
          status: "scanning" as TaskStatus,
          progress: 50,
          updatedAt: new Date(),
        });

        setTimeout(
          () => pollForResults(nextTask.id, analysisId),
          POLL_INTERVAL
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      } catch (error) {
        if (error instanceof Error && error.message === "RATE_LIMIT") {
          console.log(
            `Rate limited while submitting ${nextTask.file.name}, will retry`
          );
          updateTask(nextTask.id, {
            status: "pending" as TaskStatus,
            progress: 0,
            updatedAt: new Date(),
          });
          currentlyProcessingRef.current.delete(nextTask.id);
          await new Promise((resolve) =>
            setTimeout(resolve, RATE_LIMITED_POLL_INTERVAL)
          );
          return true;
        } else {
          console.error(`Error processing task ${nextTask.id}:`, error);
          updateTask(nextTask.id, {
            status: "error" as TaskStatus,
            error: error instanceof Error ? error.message : "Unknown error",
            progress: 0,
            updatedAt: new Date(),
          });
          currentlyProcessingRef.current.delete(nextTask.id);
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
        // Get current tasks to check if everything is truly done
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
          ["uploading", "scanning"].includes(task.status)
        );

        // If no pending tasks and no tasks currently being processed, stop processing
        if (
          pendingTasks.length === 0 &&
          processingTasks.length === 0 &&
          currentlyProcessingRef.current.size === 0
        ) {
          console.log("All tasks completed, stopping processing automatically");
          setIsProcessing(false);
          processingRef.current = false;
          break;
        }

        // Wait before checking again
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    processingLoopRunning.current = false;
    console.log("Processing loop ended");
  }, [updateTask, pollForResults]);

  // Start processing loop when enabled
  useEffect(() => {
    if (isProcessing && !processingLoopRunning.current) {
      runProcessingLoop();
    }
  }, [isProcessing, runProcessingLoop]);

  return {
    tasks,
    addTask,
    addTasks,
    removeTask,
    clearQueue,
    isProcessing,
    startProcessing,
    stopProcessing,
    progress,
    updateTask,
  };
}
