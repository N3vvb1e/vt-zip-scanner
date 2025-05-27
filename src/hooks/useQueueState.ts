/**
 * Basic queue state management hook
 * Handles task CRUD operations and state updates
 */

import { useState, useCallback, useRef } from "react";
import type { ScanTask, FileEntry } from "../types/index";
import { QueueManager } from "../utils/queueManager";

export interface QueueStateHook {
  tasks: ScanTask[];
  addTask: (file: FileEntry, zipFileName?: string) => void;
  addTasks: (files: FileEntry[], zipFileName?: string) => void;
  replaceTasks: (files: FileEntry[], zipFileName?: string) => void;
  removeTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<ScanTask>) => void;
  clearQueue: () => void;
  clearCompletedTasks: () => void;
  loadSavedTasks: (savedTasks: ScanTask[]) => void;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  hasUnsavedChanges: () => boolean;
  markSaved: () => void;
}

export function useQueueState(): QueueStateHook {
  const [tasks, setTasks] = useState<ScanTask[]>([]);
  const hasUnsavedChanges = useRef(false);

  // Calculate progress using QueueManager
  const progress = QueueManager.calculateProgress(tasks);

  // Add a new task to the queue
  const addTask = useCallback((file: FileEntry, zipFileName?: string) => {
    try {
      const newTask = QueueManager.createTask(file, zipFileName);
      setTasks((prevTasks) => [...prevTasks, newTask]);
      hasUnsavedChanges.current = true;
    } catch (error) {
      console.error("Error in addTask:", error);
    }
  }, []);

  // Add multiple tasks at once
  const addTasks = useCallback((files: FileEntry[], zipFileName?: string) => {
    const newTasks = QueueManager.createTasks(files, zipFileName);
    setTasks((prevTasks) => [...prevTasks, ...newTasks]);
    hasUnsavedChanges.current = true;
  }, []);

  // Replace all tasks (used when uploading new files)
  const replaceTasks = useCallback(
    (files: FileEntry[], zipFileName?: string) => {
      const newTasks = QueueManager.createTasks(files, zipFileName);
      console.log(`Replacing queue with ${newTasks.length} new tasks`);
      setTasks(newTasks);
      hasUnsavedChanges.current = true;
    },
    []
  );

  // Remove a task from the queue
  const removeTask = useCallback((id: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    hasUnsavedChanges.current = true;
  }, []);

  // Helper to update a task (optimized to reduce unnecessary saves)
  const updateTask = useCallback((id: string, updates: Partial<ScanTask>) => {
    try {
      setTasks((prevTasks) => {
        if (!Array.isArray(prevTasks)) {
          console.error("updateTask: prevTasks is not an array", prevTasks);
          return [];
        }

        return prevTasks
          .map((task) => {
            if (!task || !task.id) {
              console.warn("updateTask: Found invalid task", task);
              return task;
            }

            return task.id === id
              ? { ...task, ...updates, updatedAt: new Date() }
              : task;
          })
          .filter(Boolean); // Remove any null/undefined tasks
      });

      // Only mark as having unsaved changes for significant status changes
      // Exclude completed/error/reused from triggering saves since they go to history
      const isSignificantUpdate =
        updates.status &&
        ["pending", "hashing", "uploading", "scanning"].includes(
          updates.status
        );

      if (isSignificantUpdate) {
        hasUnsavedChanges.current = true;
      }
    } catch (error) {
      console.error("Error in updateTask:", error, { id, updates });
    }
  }, []);

  // Clear all tasks
  const clearQueue = useCallback(() => {
    setTasks([]);
    hasUnsavedChanges.current = false;
  }, []);

  // Clear only completed tasks (keep pending/processing ones)
  const clearCompletedTasks = useCallback(() => {
    console.log("Clearing completed tasks");
    setTasks((prevTasks) =>
      prevTasks.filter(
        (task) => task.status !== "completed" && task.status !== "error"
      )
    );
    hasUnsavedChanges.current = true;
  }, []);

  // Load saved tasks from persistence
  const loadSavedTasks = useCallback((savedTasks: ScanTask[]) => {
    setTasks(savedTasks);
    hasUnsavedChanges.current = false; // These are already saved
  }, []);

  return {
    tasks,
    addTask,
    addTasks,
    replaceTasks,
    removeTask,
    updateTask,
    clearQueue,
    clearCompletedTasks,
    loadSavedTasks,
    progress,
    hasUnsavedChanges: () => hasUnsavedChanges.current,
    markSaved: () => {
      hasUnsavedChanges.current = false;
    },
  };
}
