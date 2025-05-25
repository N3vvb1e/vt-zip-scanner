/**
 * Settings Repository
 * Handles settings-related database operations
 */

import { BaseRepository } from "../database/baseRepository";
import { DB_CONFIG } from "../database/databaseManager";

export interface Settings {
  historyRetentionDays: number;
  autoStartScanning: boolean;
  lastCleanup: Date;
}

const DEFAULT_SETTINGS: Settings = {
  historyRetentionDays: 30,
  autoStartScanning: true,
  lastCleanup: new Date(),
};

export interface SettingsRepositoryInterface {
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<Settings>): Promise<void>;
  resetSettings(): Promise<void>;
}

export class SettingsRepository extends BaseRepository implements SettingsRepositoryInterface {
  /**
   * Get settings
   */
  async getSettings(): Promise<Settings> {
    return this.withReadTransaction([DB_CONFIG.STORES.SETTINGS], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS);
      const settings = await this.getRecord(store, "general");
      
      return (settings as unknown as Settings) || { ...DEFAULT_SETTINGS };
    });
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<Settings>): Promise<void> {
    await this.withWriteTransaction([DB_CONFIG.STORES.SETTINGS], async (transaction) => {
      const store = transaction.objectStore(DB_CONFIG.STORES.SETTINGS);

      // Get current settings within the same transaction
      const current = await this.getRecord(store, "general");
      const currentSettings = (current as unknown as Settings) || { ...DEFAULT_SETTINGS };

      const updated = { ...currentSettings, ...updates, key: "general" };

      await this.putRecord(store, updated);
    });
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<void> {
    await this.updateSettings({ ...DEFAULT_SETTINGS });
  }
}
