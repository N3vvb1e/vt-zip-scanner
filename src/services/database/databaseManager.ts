/**
 * Database Manager
 * Handles IndexedDB initialization and low-level operations
 */

export const DB_CONFIG = {
  NAME: "VirusTotalScanner",
  VERSION: 1,
  STORES: {
    QUEUE: "queue",
    HISTORY: "history",
    FILES: "files",
    SETTINGS: "settings",
  },
} as const;

export interface DatabaseManagerInterface {
  init(): Promise<void>;
  getDatabase(): Promise<IDBDatabase>;
  transaction(
    storeNames: string[],
    mode?: IDBTransactionMode
  ): Promise<IDBTransaction>;
  close(): void;
}

/**
 * Manages IndexedDB database connection and initialization
 */
export class DatabaseManager implements DatabaseManagerInterface {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.openDatabase();
    await this.initPromise;
  }

  /**
   * Get the database instance
   */
  async getDatabase(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  /**
   * Create a transaction
   */
  async transaction(
    storeNames: string[],
    mode: IDBTransactionMode = "readonly"
  ): Promise<IDBTransaction> {
    const db = await this.getDatabase();
    return db.transaction(storeNames, mode);
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * Open IndexedDB database
   */
  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(new Error("Failed to open database"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("IndexedDB opened successfully");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db, event);
      };
    });
  }

  /**
   * Create object stores during database upgrade
   */
  private createObjectStores(
    db: IDBDatabase,
    event: IDBVersionChangeEvent
  ): void {
    // Create queue store
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.QUEUE)) {
      const queueStore = db.createObjectStore(DB_CONFIG.STORES.QUEUE, {
        keyPath: "id",
      });
      queueStore.createIndex("status", "status", { unique: false });
      queueStore.createIndex("createdAt", "createdAt", { unique: false });
    }

    // Create history store
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.HISTORY)) {
      const historyStore = db.createObjectStore(DB_CONFIG.STORES.HISTORY, {
        keyPath: "id",
      });
      historyStore.createIndex("status", "status", { unique: false });
      historyStore.createIndex("createdAt", "createdAt", { unique: false });
      historyStore.createIndex("completedAt", "completedAt", { unique: false });
      historyStore.createIndex("fileName", "fileName", { unique: false });
      historyStore.createIndex("zipFileName", "zipFileName", { unique: false });
    }

    // Create files store
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.FILES)) {
      db.createObjectStore(DB_CONFIG.STORES.FILES, { keyPath: "id" });
    }

    // Create settings store
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.SETTINGS)) {
      db.createObjectStore(DB_CONFIG.STORES.SETTINGS, { keyPath: "key" });

      // Add default settings
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS);

      store.add({
        key: "general",
        historyRetentionDays: 30,
        autoStartScanning: true,
        lastCleanup: new Date(),
      });
    }
  }
}

// Singleton instance
export const databaseManager = new DatabaseManager();
