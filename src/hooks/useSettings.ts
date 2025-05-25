/**
 * Settings management hook
 * Handles application settings persistence
 */

import { useState, useCallback } from "react";
import { persistenceService } from "../services/persistenceService";

export interface SettingsHook {
  autoStartEnabled: boolean;
  updateSettings: (updates: { autoStartScanning?: boolean }) => Promise<void>;
  setAutoStartEnabled: (enabled: boolean) => void;
}

export function useSettings(): SettingsHook {
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  // Settings management
  const updateSettings = useCallback(
    async (updates: { autoStartScanning?: boolean }) => {
      console.log("Updating settings:", updates);

      // Update UI state immediately for better UX
      if (updates.autoStartScanning !== undefined) {
        setAutoStartEnabled(updates.autoStartScanning);
        console.log("UI state updated to:", updates.autoStartScanning);
      }

      try {
        await persistenceService.updateSettings(updates);
        console.log("Settings successfully saved to database");
      } catch (error) {
        console.error("Failed to update settings:", error);
        // Revert UI state if database update failed
        if (updates.autoStartScanning !== undefined) {
          setAutoStartEnabled(!updates.autoStartScanning);
          console.log("Reverted UI state to:", !updates.autoStartScanning);
        }
      }
    },
    []
  );

  return {
    autoStartEnabled,
    updateSettings,
    setAutoStartEnabled,
  };
}
