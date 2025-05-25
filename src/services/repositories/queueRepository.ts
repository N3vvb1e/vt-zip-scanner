/**
 * Queue Repository
 * Handles queue-related database operations
 */

import type { ScanTask } from "../../types";
import { BaseRepository } from "../database/baseRepository";
import { DB_CONFIG } from "../database/databaseManager";

interface FileData {
  id: string;
  blob: Blob;
  metadata: {
    name: string;
    size: number;
    type: string;
    path: string;
  };
}

export interface QueueRepositoryInterface {
  saveQueue(tasks: ScanTask[]): Promise<void>;
  loadQueue(): Promise<ScanTask[]>;
  clearQueue(): Promise<void>;
}

export class QueueRepository
  extends BaseRepository
  implements QueueRepositoryInterface
{
  /**
   * Save current queue state
   */
  async saveQueue(tasks: ScanTask[]): Promise<void> {
    await this.withWriteTransaction(
      [DB_CONFIG.STORES.QUEUE, DB_CONFIG.STORES.FILES],
      async (transaction) => {
        const queueStore = transaction.objectStore(DB_CONFIG.STORES.QUEUE);
        const filesStore = transaction.objectStore(DB_CONFIG.STORES.FILES);

        // Clear existing queue
        await this.clearStore(queueStore);

        // Save each task
        for (const task of tasks) {
          try {
            // Save file blob separately if it exists
            if (task.file.blob) {
              await this.putRecord(filesStore, {
                id: task.file.id,
                blob: task.file.blob,
                metadata: {
                  name: task.file.name,
                  size: task.file.size,
                  type: task.file.type,
                  path: task.file.path,
                },
              });
            }

            // Save task without blob
            const taskToSave = {
              ...task,
              file: {
                ...task.file,
                blob: undefined, // Don't store blob in queue
              },
            };
            await this.putRecord(queueStore, taskToSave);
          } catch (error) {
            console.error(`Error saving task ${task.id}:`, error);
            // Continue with other tasks even if one fails
          }
        }
      }
    );
  }

  /**
   * Load queue state
   */
  async loadQueue(): Promise<ScanTask[]> {
    return this.withReadTransaction(
      [DB_CONFIG.STORES.QUEUE, DB_CONFIG.STORES.FILES],
      async (transaction) => {
        const queueStore = transaction.objectStore(DB_CONFIG.STORES.QUEUE);
        const filesStore = transaction.objectStore(DB_CONFIG.STORES.FILES);

        const tasks = await this.getAllFromStore<ScanTask>(queueStore);
        if (tasks.length > 0) {
          console.log(`Found ${tasks.length} tasks in queue store`);
        }

        // Restore file blobs
        const validTasks: ScanTask[] = [];
        for (const task of tasks) {
          try {
            const fileData = await this.getRecord<FileData>(
              filesStore,
              task.file.id
            );

            if (fileData?.blob) {
              task.file.blob = fileData.blob;
              validTasks.push(task);
            } else {
              // For completed tasks, we can still show them even without blobs
              if (task.status === "completed" || task.status === "error") {
                validTasks.push(task);
              }
            }
          } catch (error) {
            console.error(`Error loading blob for task ${task.id}:`, error);
            // For completed tasks, include them anyway for display
            if (task.status === "completed" || task.status === "error") {
              validTasks.push(task);
            }
          }
        }

        // Sort by creation date
        validTasks.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        if (validTasks.length > 0) {
          console.log(
            `Loaded ${validTasks.length} valid tasks out of ${tasks.length} total tasks`
          );
        }
        return validTasks;
      }
    );
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    await this.withWriteTransaction(
      [DB_CONFIG.STORES.QUEUE],
      async (transaction) => {
        const queueStore = transaction.objectStore(DB_CONFIG.STORES.QUEUE);
        await this.clearStore(queueStore);
      }
    );
  }
}
