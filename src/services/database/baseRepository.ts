/**
 * Base Repository
 * Provides common database operations for all repositories
 */

import {
  databaseManager,
  type DatabaseManagerInterface,
} from "./databaseManager";

export abstract class BaseRepository {
  protected dbManager: DatabaseManagerInterface;

  constructor(dbManager: DatabaseManagerInterface = databaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Get all records from a store
   */
  protected getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all records from an index
   */
  protected getAllFromIndex<T>(
    index: IDBIndex,
    range?: IDBKeyRange
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request = range ? index.getAll(range) : index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single record
   */
  protected getRecord<T = unknown>(
    store: IDBObjectStore,
    key: string
  ): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Put a record
   */
  protected putRecord(store: IDBObjectStore, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add a record
   */
  protected addRecord(store: IDBObjectStore, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a record
   */
  protected deleteRecord(store: IDBObjectStore, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all records from a store
   */
  protected clearStore(store: IDBObjectStore): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count records in a store
   */
  protected countRecords(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Complete a transaction
   */
  protected completeTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Execute operations within a transaction
   */
  protected async withTransaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => Promise<T>
  ): Promise<T> {
    const transaction = await this.dbManager.transaction(storeNames, mode);

    const result = await operation(transaction);
    await this.completeTransaction(transaction);
    return result;
  }

  /**
   * Execute operations within a read-only transaction
   */
  protected async withReadTransaction<T>(
    storeNames: string[],
    operation: (transaction: IDBTransaction) => Promise<T>
  ): Promise<T> {
    return this.withTransaction(storeNames, "readonly", operation);
  }

  /**
   * Execute operations within a read-write transaction
   */
  protected async withWriteTransaction<T>(
    storeNames: string[],
    operation: (transaction: IDBTransaction) => Promise<T>
  ): Promise<T> {
    return this.withTransaction(storeNames, "readwrite", operation);
  }
}
