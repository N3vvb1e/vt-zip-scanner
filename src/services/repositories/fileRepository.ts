/**
 * File Repository
 * Handles file storage and retrieval operations
 */

import { BaseRepository } from "../database/baseRepository";
import { DB_CONFIG } from "../database/databaseManager";

export interface FileData {
  id: string;
  blob: Blob;
  metadata: {
    name: string;
    size: number;
    type: string;
    path: string;
  };
}

export interface FileRepositoryInterface {
  getFile(fileId: string): Promise<Blob | null>;
  saveFile(fileData: FileData): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
  getStorageStats(): Promise<{
    filesCount: number;
    totalSize: number;
  }>;
}

export class FileRepository extends BaseRepository implements FileRepositoryInterface {
  /**
   * Get a file from storage
   */
  async getFile(fileId: string): Promise<Blob | null> {
    return this.withReadTransaction([DB_CONFIG.STORES.FILES], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.FILES);
      const fileData = await this.getRecord<FileData>(store, fileId);
      return fileData?.blob || null;
    });
  }

  /**
   * Save a file to storage
   */
  async saveFile(fileData: FileData): Promise<void> {
    await this.withWriteTransaction([DB_CONFIG.STORES.FILES], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.FILES);
      await this.putRecord(store, fileData);
    });
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.withWriteTransaction([DB_CONFIG.STORES.FILES], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.FILES);
      await this.deleteRecord(store, fileId);
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    filesCount: number;
    totalSize: number;
  }> {
    return this.withReadTransaction([DB_CONFIG.STORES.FILES], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.FILES);
      
      const filesCount = await this.countRecords(store);
      
      // Calculate total file size
      let totalSize = 0;
      try {
        const allFiles = await this.getAllFromStore<FileData>(store);
        totalSize = allFiles.reduce((total, file) => {
          if (file.blob) {
            return total + file.blob.size;
          } else if (file.metadata?.size) {
            return total + file.metadata.size;
          }
          return total;
        }, 0);
      } catch (error) {
        console.warn("Failed to calculate total file size:", error);
      }

      return {
        filesCount,
        totalSize,
      };
    });
  }
}
