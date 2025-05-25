/**
 * Task polling hook
 * Handles VirusTotal scan result polling with adaptive intervals
 */

import { useCallback, useRef } from "react";
import type { ScanTask, AnalysisReport } from "../types/index";
import { getReport } from "../services/virusTotalService";
import { RATE_LIMIT_CONFIG, PROCESSING_CONFIG } from "../config/queueConfig";

export interface TaskPollingHook {
  pollForResults: (
    taskId: string,
    analysisId: string,
    retryCount?: number
  ) => void;
  stopPolling: (taskId: string) => void;
  isPolling: (taskId: string) => boolean;
}

export function useTaskPolling(
  updateTask: (id: string, updates: Partial<ScanTask>) => void,
  onTaskCompleted: (taskId: string, report: AnalysisReport) => Promise<void>,
  onTaskError: (taskId: string, error: unknown) => Promise<void>,
  canMakeRequest: () => boolean,
  recordRequest: () => void,
  getWaitTime: () => number,
  isProcessingActive: () => boolean,
  getCurrentlyProcessing: () => Set<string>,
  getScanStartTimes: () => Map<string, number>
): TaskPollingHook {
  const pollingTimeouts = useRef<Map<string, number>>(new Map());

  // Stop polling for a specific task
  const stopPolling = useCallback((taskId: string) => {
    const timeout = pollingTimeouts.current.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      pollingTimeouts.current.delete(taskId);
    }
  }, []);

  // Check if currently polling a task
  const isPolling = useCallback((taskId: string) => {
    return pollingTimeouts.current.has(taskId);
  }, []);

  // Calculate adaptive polling interval based on scan characteristics
  const calculatePollInterval = useCallback(
    (taskId: string): number => {
      const startTime = getScanStartTimes().get(taskId);
      const elapsedTime = startTime
        ? Math.round((Date.now() - startTime) / 1000)
        : 0;

      const isLikelySingleFile = getCurrentlyProcessing().size <= 1;
      const isSmallFile = elapsedTime < 30;
      const isLongRunning = elapsedTime > 120;
      const isVeryLongRunning = elapsedTime > 300;

      let nextPollInterval: number = RATE_LIMIT_CONFIG.POLL_INTERVAL; // Default 20s

      if (isVeryLongRunning) {
        nextPollInterval = 30000; // 30s for very long running scans
      } else if (isLongRunning) {
        nextPollInterval = 20000; // 20s for long running scans
      } else if (isLikelySingleFile && isSmallFile) {
        nextPollInterval = 8000; // 8s for small single files
      } else if (isLikelySingleFile) {
        nextPollInterval = 12000; // 12s for larger single files
      } else if (isSmallFile) {
        nextPollInterval = 15000; // 15s for small files in batch
      }

      return nextPollInterval;
    },
    [getCurrentlyProcessing, getScanStartTimes]
  );

  // Update progress for long-running scans
  const updateLongRunningProgress = useCallback(
    (taskId: string) => {
      const startTime = getScanStartTimes().get(taskId);
      const elapsedTime = startTime
        ? Math.round((Date.now() - startTime) / 1000)
        : 0;

      if (elapsedTime > 120) {
        // Long running (over 2 minutes)
        const progressBoost = Math.min(10, Math.floor(elapsedTime / 60));
        updateTask(taskId, { progress: Math.min(95, 60 + progressBoost) });
      }
    },
    [updateTask, getScanStartTimes]
  );

  // Handle pending scan (still processing)
  const handlePendingScan = useCallback(
    async (taskId: string, analysisId: string, retryCount: number) => {
      const startTime = getScanStartTimes().get(taskId);
      const elapsedTime = startTime
        ? Math.round((Date.now() - startTime) / 1000)
        : 0;

      updateLongRunningProgress(taskId);

      const nextPollInterval = calculatePollInterval(taskId);
      const statusEmoji =
        elapsedTime > 300 ? "🐌" : elapsedTime > 120 ? "⏳" : "🔄";

      console.log(
        `${statusEmoji} Scan in progress for ${taskId} (${elapsedTime}s elapsed), next poll in ${Math.round(
          nextPollInterval / 1000
        )}s`
      );

      const timeout = setTimeout(
        () => pollForResults(taskId, analysisId, retryCount),
        nextPollInterval
      );
      pollingTimeouts.current.set(taskId, timeout);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateLongRunningProgress, calculatePollInterval, getScanStartTimes]
  );

  // Handle scan errors with retry logic
  const handleScanError = useCallback(
    async (
      taskId: string,
      analysisId: string,
      retryCount: number,
      error: unknown
    ) => {
      stopPolling(taskId);

      if (error instanceof Error && error.message === "RATE_LIMIT") {
        console.log(
          `Rate limited while polling for task ${taskId}, waiting longer`
        );
        const timeout = setTimeout(
          () => pollForResults(taskId, analysisId, retryCount),
          RATE_LIMIT_CONFIG.RATE_LIMITED_POLL_INTERVAL
        );
        pollingTimeouts.current.set(taskId, timeout);
      } else {
        console.error(`Error polling for results for task ${taskId}:`, error);

        if (retryCount < PROCESSING_CONFIG.MAX_RETRIES) {
          console.log(
            `Retrying polling for task ${taskId} (attempt ${retryCount + 1}/${
              PROCESSING_CONFIG.MAX_RETRIES
            })`
          );
          const timeout = setTimeout(
            () => pollForResults(taskId, analysisId, retryCount + 1),
            RATE_LIMIT_CONFIG.POLL_INTERVAL *
              PROCESSING_CONFIG.RETRY_DELAY_MULTIPLIER
          );
          pollingTimeouts.current.set(taskId, timeout);
        } else {
          await onTaskError(taskId, error);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopPolling, onTaskError]
  );

  // Main polling function
  const pollForResults = useCallback(
    async (taskId: string, analysisId: string, retryCount = 0) => {
      if (!isProcessingActive()) {
        stopPolling(taskId);
        return;
      }

      // Check for scan timeout
      const startTime = getScanStartTimes().get(taskId);
      if (startTime && Date.now() - startTime > 10 * 60 * 1000) {
        // 10 minutes
        console.log(`Scan timeout for task ${taskId}, marking as error`);
        await onTaskError(taskId, new Error("Scan timeout"));
        return;
      }

      if (!canMakeRequest()) {
        const waitTime = getWaitTime();
        console.log(
          `⏳ Rate limit protection: waiting ${Math.round(
            waitTime / 1000
          )}s before polling ${taskId}`
        );
        const timeout = setTimeout(
          () => pollForResults(taskId, analysisId, retryCount),
          waitTime
        );
        pollingTimeouts.current.set(taskId, timeout);
        return;
      }

      try {
        recordRequest();
        const report = await getReport(analysisId);

        if (report && Object.keys(report.results || {}).length > 0) {
          console.log(`Scan completed for task ${taskId}`);
          stopPolling(taskId);
          await onTaskCompleted(taskId, report);
        } else {
          await handlePendingScan(taskId, analysisId, retryCount);
        }
      } catch (error) {
        await handleScanError(taskId, analysisId, retryCount, error);
      }
    },
    [
      isProcessingActive,
      stopPolling,
      getScanStartTimes,
      onTaskError,
      canMakeRequest,
      getWaitTime,
      recordRequest,
      onTaskCompleted,
      handlePendingScan,
      handleScanError,
    ]
  );

  return {
    pollForResults,
    stopPolling,
    isPolling,
  };
}
