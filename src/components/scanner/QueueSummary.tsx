import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { ScanTask } from "../../types";
import { Progress } from "../ui/Progress";
import { Button } from "../ui/Button";

interface QueueSummaryProps {
  tasks: ScanTask[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  isProcessing: boolean;
  onStartProcessing: () => void;
  onStopProcessing: () => void;
  onClearQueue: () => void;
  onDownloadAll: () => void;
}

export function QueueSummary({
  tasks,
  progress,
  isProcessing,
  onStartProcessing,
  onStopProcessing,
  onClearQueue,
  onDownloadAll,
}: QueueSummaryProps) {
  // Safety check for tasks array
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return null;
  }

  try {
    const pendingCount = tasks.filter((t) => t?.status === "pending").length;
    const processingCount = tasks.filter(
      (t) =>
        t?.status && ["hashing", "uploading", "scanning"].includes(t.status)
    ).length;
    const completedCount = tasks.filter(
      (t) => t?.status === "completed" || t?.status === "reused"
    ).length;
    const errorCount = tasks.filter((t) => t?.status === "error").length;

    const maliciousCount = tasks.reduce((count, task) => {
      if (
        (task?.status === "completed" || task?.status === "reused") &&
        task.report?.stats?.malicious &&
        task.report.stats.malicious > 0
      ) {
        return count + 1;
      }
      return count;
    }, 0);

    const safeCount = Math.max(0, completedCount - maliciousCount);

    const safeTasks = tasks.filter(
      (t) =>
        (t?.status === "completed" || t?.status === "reused") &&
        (!t.report?.stats?.malicious || t.report.stats.malicious === 0)
    );
    const canDownloadAll = safeTasks.length > 0;

    // Show processing animation only when there are tasks actually being processed
    const showProcessingAnimation =
      isProcessing && (pendingCount > 0 || processingCount > 0);

    return (
      <motion.div
        className="border rounded-lg p-4 bg-card mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <h2 className="text-lg font-medium mb-2 sm:mb-0">Scan Queue</h2>

          <div className="flex flex-wrap gap-2">
            {pendingCount > 0 &&
              (isProcessing ? (
                <Button variant="outline" size="sm" onClick={onStopProcessing}>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Pause
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={onStartProcessing}>
                  <Clock className="h-4 w-4 mr-2" />
                  Start Scanning
                </Button>
              ))}

            {canDownloadAll && (
              <Button variant="outline" size="sm" onClick={onDownloadAll}>
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                Download Safe Files
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={onClearQueue}>
              <XCircle className="h-4 w-4 mr-2" />
              Clear Queue
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-secondary/50 rounded-md p-3">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-semibold mt-1">{pendingCount}</p>
          </div>

          <div className="bg-secondary/50 rounded-md p-3">
            <div className="flex items-center">
              <Loader2
                className={`h-5 w-5 mr-2 text-primary ${
                  showProcessingAnimation ? "animate-spin" : ""
                }`}
              />
              <span className="text-sm">Processing</span>
            </div>
            <p className="text-2xl font-semibold mt-1">{processingCount}</p>
          </div>

          <div className="bg-secondary/50 rounded-md p-3">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              <span className="text-sm">Safe</span>
            </div>
            <p className="text-2xl font-semibold mt-1">{safeCount}</p>
          </div>

          <div className="bg-secondary/50 rounded-md p-3">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
              <span className="text-sm">Malicious/Errors</span>
            </div>
            <p className="text-2xl font-semibold mt-1">
              {maliciousCount + errorCount}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>
              {progress?.completed || 0} / {progress?.total || 0} files (
              {Math.round(progress?.percentage || 0)}%)
            </span>
          </div>
          <Progress value={progress?.percentage || 0} className="h-2" />
        </div>

        {showProcessingAnimation && (
          <div className="mt-2 text-sm text-muted-foreground">
            <p>
              Rate limited to 4 requests/minute. {processingCount} files
              currently processing.
            </p>
          </div>
        )}

        {progress?.percentage === 100 &&
          pendingCount === 0 &&
          processingCount === 0 &&
          !isProcessing && (
            <div className="mt-2 text-sm text-green-600 font-medium">
              ✅ All files scanned successfully! {safeCount} safe files ready
              for download.
            </div>
          )}
      </motion.div>
    );
  } catch (error) {
    console.error("Error in QueueSummary component:", error);
    return (
      <div className="border rounded-lg p-4 bg-card mb-6">
        <div className="text-center text-muted-foreground">
          <p>Error loading queue summary</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearQueue}
            className="mt-2"
          >
            Clear Queue
          </Button>
        </div>
      </div>
    );
  }
}
