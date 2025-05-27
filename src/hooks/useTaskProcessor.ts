/**
 * Task processor hook
 * Handles individual task processing (hash calculation, duplicate detection, submission)
 */

import { useCallback } from "react";
import type { ScanTask, TaskStatus } from "../types/index";
import { submitFile } from "../services/virusTotalService";
import { persistenceOrchestrator } from "../services/persistenceOrchestrator";
import type { HistoryEntry } from "../services/repositories/historyRepository";
import { calculateFileHashes } from "../utils/common";
import { RATE_LIMIT_CONFIG, PROCESSING_CONFIG } from "../config/queueConfig";

export interface TaskProcessorHook {
  processTask: (task: ScanTask) => Promise<void>;
}

export function useTaskProcessor(
  updateTask: (id: string, updates: Partial<ScanTask>) => void,
  addToHistory: (task: ScanTask) => Promise<void>,
  recordRequest: () => void,
  startPolling: (taskId: string, analysisId: string) => void,
  getCurrentTasks: () => ScanTask[],
  getCurrentlyProcessing: () => Set<string>,
  getScanStartTimes: () => Map<string, number>
): TaskProcessorHook {
  // Handle duplicate task (reuse existing scan)
  const handleDuplicateTask = useCallback(
    async (
      task: ScanTask,
      existingScan: HistoryEntry,
      fileHashes: { sha256: string; size: number }
    ) => {
      console.log(
        `✅ DUPLICATE DETECTED: Found existing scan for "${
          task.file.name
        }" (SHA256: ${fileHashes.sha256.substring(
          0,
          16
        )}...), reusing result and saving API quota!`
      );

      // Reuse existing scan result
      const reusedTask: ScanTask = {
        ...task,
        status: "reused" as TaskStatus,
        progress: 100,
        analysisId: existingScan.analysisId,
        report: existingScan.report,
        updatedAt: new Date(),
      };

      // Update file entry with hash
      reusedTask.file.sha256 = fileHashes.sha256;

      // Ensure the reused report has file_info for future duplicate detection
      if (reusedTask.report && !reusedTask.report.meta?.file_info) {
        reusedTask.report = {
          ...reusedTask.report,
          meta: {
            file_info: {
              sha256: fileHashes.sha256,
              sha1: "", // Not calculated locally (not needed)
              md5: "", // Not calculated locally (SHA256 is sufficient)
              size: fileHashes.size,
              file_type: task.file.type,
              filename: task.file.name,
            },
          },
        };
        console.log(
          `🔧 Enhanced reused report with local file hash for ${task.file.name}`
        );
      }

      updateTask(task.id, {
        status: "reused" as TaskStatus,
        progress: 100,
        analysisId: existingScan.analysisId,
        report: reusedTask.report,
        file: reusedTask.file,
      });

      getCurrentlyProcessing().delete(task.id);
      await addToHistory(reusedTask);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    [updateTask, addToHistory, getCurrentlyProcessing]
  );

  // Submit new task to VirusTotal
  const submitNewTask = useCallback(
    async (task: ScanTask, fileHashes: { sha256: string; size: number }) => {
      updateTask(task.id, {
        status: "uploading" as TaskStatus,
        progress: 10,
      });

      console.log(
        `📤 Submitting file: ${task.file.name} (${task.file.size} bytes)`
      );

      // Only record request for actual API calls (not duplicates)
      recordRequest();
      const analysisId = await submitFile(task.file.blob!);

      console.log(`File submitted successfully, analysis ID: ${analysisId}`);

      // Update file entry with hash
      task.file.sha256 = fileHashes.sha256;

      // For single files, start polling sooner; for multiple files, use normal interval
      const currentTaskCount = getCurrentTasks().length;

      updateTask(task.id, {
        analysisId,
        status: "scanning" as TaskStatus,
        progress: currentTaskCount === 1 ? 60 : 50, // Higher progress for single files
      });

      // Record scan start time for timeout tracking
      getScanStartTimes().set(task.id, Date.now());

      const pollDelay =
        currentTaskCount === 1
          ? PROCESSING_CONFIG.SINGLE_FILE_POLL_DELAY
          : RATE_LIMIT_CONFIG.POLL_INTERVAL;

      setTimeout(() => startPolling(task.id, analysisId), pollDelay);

      // Add delay between submissions to spread API load (skip for single files)
      if (currentTaskCount > 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, RATE_LIMIT_CONFIG.BATCH_SUBMIT_DELAY)
        );
      }
    },
    [
      updateTask,
      recordRequest,
      getCurrentTasks,
      getScanStartTimes,
      startPolling,
    ]
  );

  // Handle task processing errors
  const handleTaskError = useCallback(
    async (task: ScanTask, error: unknown) => {
      if (error instanceof Error && error.message === "RATE_LIMIT") {
        updateTask(task.id, {
          status: "pending" as TaskStatus,
          progress: 0,
        });
        getCurrentlyProcessing().delete(task.id);
        await new Promise((resolve) =>
          setTimeout(resolve, RATE_LIMIT_CONFIG.RATE_LIMITED_POLL_INTERVAL)
        );
        return;
      }

      console.error(`Error processing task ${task.id}:`, error);

      // Mark as error and add to history
      const errorTask: ScanTask = {
        ...task,
        status: "error" as TaskStatus,
        error: error instanceof Error ? error.message : "Unknown error",
        progress: 0,
        updatedAt: new Date(),
      };

      updateTask(task.id, {
        status: "error" as TaskStatus,
        error: errorTask.error,
        progress: 0,
      });

      getCurrentlyProcessing().delete(task.id);
      await addToHistory(errorTask);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    },
    [updateTask, addToHistory, getCurrentlyProcessing]
  );

  // Main task processing function
  const processTask = useCallback(
    async (task: ScanTask) => {
      try {
        console.log(`🔄 Processing task ${task.id} (${task.file.name})`);

        // Step 1: Calculate file hash for duplicate detection
        updateTask(task.id, {
          status: "hashing" as TaskStatus,
          progress: 5,
        });

        console.log(`Calculating hash for: ${task.file.name}`);
        const fileHashes = await calculateFileHashes(task.file.blob!);

        // Step 2: Check for existing scan
        console.log(`Checking for existing scan of: ${task.file.name}`);
        const existingScan = await persistenceOrchestrator.findExistingScan(
          fileHashes.sha256,
          fileHashes.size
        );

        if (existingScan) {
          await handleDuplicateTask(task, existingScan, fileHashes);
          return;
        }

        // Step 3: No existing scan found, proceed with new scan
        await submitNewTask(task, fileHashes);
      } catch (error) {
        await handleTaskError(task, error);
      }
    },
    [updateTask, handleDuplicateTask, submitNewTask, handleTaskError]
  );

  return {
    processTask,
  };
}
