/**
 * Duplicate detection hook
 * Handles file hash calculation and duplicate checking logic
 */

import { useCallback } from "react";
import type { ScanTask, TaskStatus } from "../types/index";
import type { HistoryEntry } from "../services/repositories/historyRepository";
import { persistenceOrchestrator } from "../services/persistenceOrchestrator";
import { calculateFileHashes } from "../utils/common";

export interface DuplicateDetectionHook {
  checkForDuplicate: (task: ScanTask) => Promise<{
    isDuplicate: boolean;
    existingScan?: HistoryEntry;
    fileHashes: { sha256: string; size: number };
  }>;
  createReusedTask: (
    task: ScanTask,
    existingScan: HistoryEntry,
    fileHashes: { sha256: string; size: number }
  ) => ScanTask;
}

export function useDuplicateDetection(
  updateTask: (id: string, updates: Partial<ScanTask>) => void
): DuplicateDetectionHook {
  // Check if file is a duplicate of existing scan
  const checkForDuplicate = useCallback(
    async (task: ScanTask) => {
      // Update task status to hashing
      updateTask(task.id, {
        status: "hashing" as TaskStatus,
        progress: 5,
      });

      // Calculate file hash
      const fileHashes = await calculateFileHashes(task.file.blob!);

      // Check for existing scan
      const existingScan = await persistenceOrchestrator.findExistingScan(
        fileHashes.sha256,
        fileHashes.size
      );

      return {
        isDuplicate: !!existingScan,
        existingScan: existingScan || undefined,
        fileHashes,
      };
    },
    [updateTask]
  );

  // Create a reused task from existing scan
  const createReusedTask = useCallback(
    (
      task: ScanTask,
      existingScan: HistoryEntry,
      fileHashes: { sha256: string; size: number }
    ): ScanTask => {
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
              sha1: "",
              md5: "",
              size: fileHashes.size,
              file_type: task.file.type,
              filename: task.file.name,
            },
          },
        };
      }

      return reusedTask;
    },
    []
  );

  return {
    checkForDuplicate,
    createReusedTask,
  };
}
