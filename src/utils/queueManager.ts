/**
 * Queue management utility for handling scan tasks
 */

import type { ScanTask, FileEntry, TaskStatus } from "../types";
import { generateId } from "./common";

export interface QueueProgress {
  total: number;
  completed: number;
  percentage: number;
}

// QueueStats interface removed as it was unused

export class QueueManager {
  /**
   * Create a new scan task from a file entry
   */
  static createTask(file: FileEntry, zipFileName?: string): ScanTask {
    const task: ScanTask = {
      id: generateId(),
      file,
      status: "pending" as TaskStatus,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (zipFileName) {
      (task as ScanTask & { zipFileName?: string }).zipFileName = zipFileName;
    }

    return task;
  }

  /**
   * Create multiple tasks from file entries
   */
  static createTasks(files: FileEntry[], zipFileName?: string): ScanTask[] {
    return files.map((file) => this.createTask(file, zipFileName));
  }

  /**
   * Calculate queue progress
   */
  static calculateProgress(tasks: ScanTask[]): QueueProgress {
    const total = tasks.length;
    const completed = tasks.filter(
      (task) =>
        task.status === "completed" ||
        task.status === "error" ||
        task.status === "reused"
    ).length;

    return {
      total,
      completed,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  // Note: Other utility methods were removed as they were unused
  // Only keeping the essential methods that are actually used in the codebase
}
