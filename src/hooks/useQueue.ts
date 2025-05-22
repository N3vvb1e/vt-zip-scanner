import { useState, useEffect, useCallback, useRef } from "react";
import type { ScanTask, FileEntry, TaskStatus } from "../types/index";
import { submitFile, getReport } from "../services/virusTotalService";

// Simple ID generator
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2);

// VirusTotal rate limit: 4 requests per minute
const REQUEST_LIMIT = 4;
const REQUEST_WINDOW = 60 * 1000; // 60 seconds in milliseconds
const POLL_INTERVAL = 5000; // 5 seconds between polling for results

export function useQueue() {
  const [tasks, setTasks] = useState<ScanTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const requestTimestamps = useRef<number[]>([]);
  const processingRef = useRef(false);

  // Track how many tasks are completed for progress calculation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (task) => task.status === "completed" || task.status === "error"
  ).length;

  const progress = {
    total: totalTasks,
    completed: completedTasks,
    percentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
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
  }, []);

  // Clear all tasks
  const clearQueue = useCallback(() => {
    console.log("Clearing queue and stopping processing");
    setIsProcessing(false);
    processingRef.current = false;
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
  }, []);

  // Helper to update a task
  const updateTask = useCallback((id: string, updates: Partial<ScanTask>) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );
  }, []);

  // Poll for scan results
  const pollForResults = useCallback(
    async (taskId: string, analysisId: string) => {
      // If stopped, don't continue polling
      if (!processingRef.current) return;

      try {
        const report = await getReport(analysisId);
        requestTimestamps.current.push(Date.now()); // Track request for rate limiting

        // If status is "completed" or we have results, mark as complete
        if (report && Object.keys(report.results || {}).length > 0) {
          updateTask(taskId, {
            status: "completed" as TaskStatus,
            progress: 100,
            report,
            updatedAt: new Date(),
          });
        } else {
          // Not ready yet, continue polling
          setTimeout(() => pollForResults(taskId, analysisId), POLL_INTERVAL);
        }
      } catch (error) {
        console.error(`Error polling for results for task ${taskId}:`, error);
        // If it's a temporary error, retry
        if (error instanceof Error && error.message.includes("429")) {
          // Rate limited, wait longer
          setTimeout(
            () => pollForResults(taskId, analysisId),
            POLL_INTERVAL * 2
          );
        } else {
          updateTask(taskId, {
            status: "error" as TaskStatus,
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: new Date(),
          });
        }
      }
    },
    [updateTask]
  );

  // Process the next task in the queue
  const processNextTask = useCallback(async () => {
    // If stopped, don't process
    if (!processingRef.current) return;

    // Find next pending task
    const pendingTasks = tasks.filter((task) => task.status === "pending");
    if (pendingTasks.length === 0) return;

    // Check rate limit
    const now = Date.now();
    const recentRequests = requestTimestamps.current.filter(
      (time) => now - time < REQUEST_WINDOW
    );

    if (recentRequests.length >= REQUEST_LIMIT) {
      // Hit rate limit, wait until we can make another request
      const oldestRequest = Math.min(...recentRequests);
      const timeToWait = REQUEST_WINDOW - (now - oldestRequest);
      console.log(`Rate limit hit, waiting ${timeToWait}ms`);
      setTimeout(processNextTask, timeToWait + 100); // Add 100ms buffer
      return;
    }

    // Process the next task
    const nextTask = pendingTasks[0];

    try {
      // Update task status
      updateTask(nextTask.id, {
        status: "uploading" as TaskStatus,
        progress: 10,
        updatedAt: new Date(),
      });

      // Submit file to VirusTotal
      console.log(`Submitting file: ${nextTask.file.name}`);
      const analysisId = await submitFile(nextTask.file.blob!);
      requestTimestamps.current.push(Date.now()); // Track request for rate limiting

      // Clean up old timestamps
      const submitTime = Date.now();
      requestTimestamps.current = requestTimestamps.current.filter(
        (time) => submitTime - time < REQUEST_WINDOW
      );

      console.log(`File submitted successfully, analysis ID: ${analysisId}`);

      // Update task with analysis ID
      updateTask(nextTask.id, {
        analysisId,
        status: "scanning" as TaskStatus,
        progress: 50,
        updatedAt: new Date(),
      });

      // Start polling for results
      pollForResults(nextTask.id, analysisId);

      // Process next task immediately if we haven't hit rate limit
      processNextTask();
    } catch (error) {
      console.error(`Error processing task ${nextTask.id}:`, error);
      updateTask(nextTask.id, {
        status: "error" as TaskStatus,
        error: error instanceof Error ? error.message : "Unknown error",
        progress: 0,
        updatedAt: new Date(),
      });

      // Continue with next task
      processNextTask();
    }
  }, [tasks, updateTask, pollForResults]);

  // Start processing when isProcessing changes
  useEffect(() => {
    if (isProcessing && tasks.some((task) => task.status === "pending")) {
      processNextTask();
    }
  }, [isProcessing, tasks, processNextTask]);

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
