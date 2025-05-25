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

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  errors: number;
  reused: number;
}

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

  /**
   * Get queue statistics
   */
  static getStats(tasks: ScanTask[]): QueueStats {
    const stats: QueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      errors: 0,
      reused: 0,
    };

    tasks.forEach((task) => {
      switch (task.status) {
        case "pending":
          stats.pending++;
          break;
        case "hashing":
        case "uploading":
        case "scanning":
          stats.processing++;
          break;
        case "completed":
          stats.completed++;
          break;
        case "error":
          stats.errors++;
          break;
        case "reused":
          stats.reused++;
          break;
      }
    });

    return stats;
  }

  /**
   * Filter tasks by status
   */
  static filterByStatus(tasks: ScanTask[], status: TaskStatus): ScanTask[] {
    return tasks.filter((task) => task.status === status);
  }

  /**
   * Get active tasks (not completed, error, or reused)
   */
  static getActiveTasks(tasks: ScanTask[]): ScanTask[] {
    return tasks.filter(
      (task) =>
        task.status === "pending" ||
        task.status === "hashing" ||
        task.status === "uploading" ||
        task.status === "scanning"
    );
  }

  /**
   * Get completed tasks (completed, error, or reused)
   */
  static getCompletedTasks(tasks: ScanTask[]): ScanTask[] {
    return tasks.filter(
      (task) =>
        task.status === "completed" ||
        task.status === "error" ||
        task.status === "reused"
    );
  }

  /**
   * Get next pending task, prioritizing smaller files
   */
  static getNextPendingTask(
    tasks: ScanTask[],
    currentlyProcessing: Set<string>
  ): ScanTask | null {
    const pendingTasks = tasks
      .filter(
        (task) =>
          task.status === "pending" && !currentlyProcessing.has(task.id)
      )
      .sort((a, b) => a.file.size - b.file.size); // Smaller files first

    return pendingTasks[0] || null;
  }

  /**
   * Update a task with new properties
   */
  static updateTask(
    tasks: ScanTask[],
    taskId: string,
    updates: Partial<ScanTask>
  ): ScanTask[] {
    return tasks.map((task) =>
      task.id === taskId
        ? { ...task, ...updates, updatedAt: new Date() }
        : task
    );
  }

  /**
   * Remove a task from the queue
   */
  static removeTask(tasks: ScanTask[], taskId: string): ScanTask[] {
    return tasks.filter((task) => task.id !== taskId);
  }

  /**
   * Check if there are tasks that need significant status changes saved
   */
  static hasSignificantChanges(tasks: ScanTask[]): boolean {
    return tasks.some(
      (task) =>
        task.status === "pending" ||
        task.status === "hashing" ||
        task.status === "uploading"
    );
  }

  /**
   * Validate task integrity
   */
  static validateTasks(tasks: unknown): ScanTask[] {
    if (!Array.isArray(tasks)) {
      console.error("validateTasks: tasks is not an array", tasks);
      return [];
    }

    return tasks
      .filter((task) => {
        if (!task || typeof task !== "object" || !("id" in task)) {
          console.warn("validateTasks: Found invalid task", task);
          return false;
        }
        return true;
      })
      .map((task) => task as ScanTask);
  }
}
