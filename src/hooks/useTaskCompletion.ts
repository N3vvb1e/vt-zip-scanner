/**
 * Task completion hook
 * Handles task completion and error states
 */

import { useCallback } from "react";
import type { ScanTask, TaskStatus, AnalysisReport } from "../types/index";

export interface TaskCompletionHook {
  handleTaskCompleted: (
    taskId: string,
    report: AnalysisReport
  ) => Promise<void>;
  handleTaskError: (taskId: string, error: unknown) => Promise<void>;
}

export function useTaskCompletion(
  updateTask: (id: string, updates: Partial<ScanTask>) => void,
  addToHistory: (task: ScanTask) => Promise<void>,
  getCurrentTasks: () => ScanTask[],
  getCurrentlyProcessing: () => Set<string>,
  getScanStartTimes: () => Map<string, number>
): TaskCompletionHook {
  // Handle completed scan
  const handleTaskCompleted = useCallback(
    async (taskId: string, report: AnalysisReport) => {
      // Use current tasks to avoid stale closure
      const task = getCurrentTasks().find((t) => t.id === taskId);
      if (!task) {
        console.error(
          `Task ${taskId} not found when trying to mark as completed`
        );
        getCurrentlyProcessing().delete(taskId);
        getScanStartTimes().delete(taskId);
        return;
      }

      // Enhance the report with local file hash if VirusTotal doesn't provide it
      const enhancedReport = { ...report };
      if (!enhancedReport.meta?.file_info && task.file.sha256) {
        enhancedReport.meta = {
          file_info: {
            sha256: task.file.sha256,
            sha1: "", // Not calculated locally (not needed)
            md5: "", // Not calculated locally (SHA256 is sufficient)
            size: task.file.size,
            file_type: task.file.type,
            filename: task.file.name,
          },
        };
      }

      const completedTask: ScanTask = {
        ...task,
        status: "completed" as TaskStatus,
        progress: 100,
        report: enhancedReport,
        updatedAt: new Date(),
      };

      updateTask(taskId, {
        status: "completed" as TaskStatus,
        progress: 100,
        report: enhancedReport,
      });

      getCurrentlyProcessing().delete(taskId);
      getScanStartTimes().delete(taskId);

      // Add to history with error handling (but keep task in queue for UI)
      try {
        await addToHistory(completedTask);
        console.log(`✅ Task ${taskId} completed and added to history`);
      } catch (error) {
        console.error("Error adding completed task to history:", error);
      }
    },
    [
      updateTask,
      addToHistory,
      getCurrentTasks,
      getCurrentlyProcessing,
      getScanStartTimes,
    ]
  );

  // Handle task error
  const handleTaskError = useCallback(
    async (taskId: string, error: unknown) => {
      // Use current tasks to avoid stale closure
      const task = getCurrentTasks().find((t) => t.id === taskId);
      if (!task) {
        console.error(`Task ${taskId} not found when trying to mark as error`);
        getCurrentlyProcessing().delete(taskId);
        getScanStartTimes().delete(taskId);
        return;
      }

      const errorTask: ScanTask = {
        ...task,
        status: "error" as TaskStatus,
        error: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      };

      updateTask(taskId, {
        status: "error" as TaskStatus,
        error: errorTask.error,
      });

      getCurrentlyProcessing().delete(taskId);
      getScanStartTimes().delete(taskId);

      // Add to history but keep in queue for UI
      try {
        await addToHistory(errorTask);
        console.log(`❌ Error task ${taskId} added to history`);
      } catch (error) {
        console.error("Error adding error task to history:", error);
      }
    },
    [
      updateTask,
      addToHistory,
      getCurrentTasks,
      getCurrentlyProcessing,
      getScanStartTimes,
    ]
  );

  return {
    handleTaskCompleted,
    handleTaskError,
  };
}
